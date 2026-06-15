// 舞力打卡 - 舞蹈卡API路由
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// 所有路由需要认证
router.use(authMiddleware);

// GET /api/cards - 获取用户所有舞蹈卡
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const cards = db.prepare('SELECT * FROM cards WHERE userId = ? ORDER BY createdAt DESC').all(req.userId);
    console.log('[CARDS] get all:', cards.length);
    res.json({ cards });
  } catch (err) {
    console.error('[CARDS] get error:', err);
    res.status(500).json({ error: '获取舞蹈卡失败' });
  }
});

// GET /api/cards/stats - 统计数据
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const cards = db.prepare('SELECT * FROM cards WHERE userId = ? AND status = ? ORDER BY createdAt DESC').all(req.userId, 'active');
    const card = cards[0] || null;

    if (!card) {
      return res.json({ stats: { hasCard: false } });
    }

    const checkins = db.prepare('SELECT * FROM checkins WHERE cardId = ?').all(card.id);
    const done = checkins.filter(c => c.status === 'done').length;
    const used = card.usedLessons ?? done;  // 用??而非||，避免0被当作falsy
    const hasTarget = (card.targetPrice && card.targetPrice > 0);
    const target = hasTarget ? card.targetPrice : 0;
    const need = target > 0 ? Math.ceil(card.totalPrice / target) : 0;
    const remain = card.endDate
      ? Math.max(0, Math.floor((new Date(card.endDate + 'T23:59:59').getTime() - Date.now()) / 86400000))
      : 365; // 无endDate默认365天
    const actual = (used > 0 && need > 0) ? card.totalPrice / used : 0;
    const progress = need > 0 ? Math.min(100, Math.round((used / need) * 100)) : 0;

    // 动态计算周目标
    const remainMonths = Math.max(1, Math.ceil(remain / 30));
    const weeklyTarget = Math.ceil(need / (remainMonths * 4));

    res.json({
      stats: {
        hasCard: true,
        cardName: card.name,
        cardType: card.type,
        totalPrice: card.totalPrice,
        targetPrice: target,
        hasTarget,
        used,
        remainDays: remain,
        actualPrice: actual,
        need,
        progress,
        weeklyTarget,
        totalSessions: card.totalSessions,
        startDate: card.startDate,
        endDate: card.endDate
      }
    });
  } catch (err) {
    console.error('[CARDS] stats error:', err);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// GET /api/cards/:id - 获取单张舞蹈卡
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const card = db.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').get(req.params.id, req.userId);
    if (!card) return res.status(404).json({ error: '舞蹈卡不存在' });
    res.json({ card });
  } catch (err) {
    res.status(500).json({ error: '获取舞蹈卡失败' });
  }
});

// POST /api/cards - 创建舞蹈卡
router.post('/', (req, res) => {
  try {
    const { name, type, totalPrice, targetPrice, startDate, endDate, totalSessions } = req.body;
    const db = getDb();
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO cards (userId, name, type, totalPrice, targetPrice, startDate, endDate, totalSessions, usedLessons, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)
    `).run(
      req.userId,
      name || '我的舞蹈卡',
      type || 'period',
      totalPrice || 0,
      targetPrice || 40,
      startDate || null,
      endDate || null,
      totalSessions || 0,
      now, now
    );
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
    console.log('[CARDS] created:', card.id, card.name);
    res.json({ card });
  } catch (err) {
    console.error('[CARDS] create error:', err);
    res.status(500).json({ error: '创建失败' });
  }
});

// PUT /api/cards/:id - 更新舞蹈卡
router.put('/:id', (req, res) => {
  try {
    const { name, type, totalPrice, targetPrice, endDate, totalSessions, status } = req.body;
    const db = getDb();
    const now = Date.now();
    const existing = db.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').get(req.params.id, req.userId);
    if (!existing) return res.status(404).json({ error: '舞蹈卡不存在' });

    db.prepare(`
      UPDATE cards SET name=?, type=?, totalPrice=?, targetPrice=?, endDate=?, totalSessions=?, status=?, updatedAt=?
      WHERE id=?
    `).run(
      name || existing.name,
      type || existing.type,
      totalPrice ?? existing.totalPrice,
      targetPrice ?? existing.targetPrice,
      endDate || existing.endDate,
      totalSessions ?? existing.totalSessions,
      status || existing.status,
      now,
      req.params.id
    );
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    res.json({ card });
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

// POST /api/cards/recover - 缺课补救计算
router.post('/recover', (req, res) => {
  try {
    const { thisMonth } = req.body;
    const db = getDb();
    const cards = db.prepare('SELECT * FROM cards WHERE userId = ? AND status = ? ORDER BY createdAt DESC').all(req.userId, 'active');
    const card = cards[0];
    if (!card) return res.status(400).json({ error: '没有激活的舞蹈卡' });

    const checkins = db.prepare('SELECT * FROM checkins WHERE cardId = ?').all(card.id);
    const totalDone = checkins.filter(c => c.status === 'done').length + (parseInt(thisMonth) || 0);
    const target = card.targetPrice || 40;
    const need = Math.ceil(card.totalPrice / target);
    const remainNeed = Math.max(0, need - totalDone);
    const remainDays = Math.max(0, Math.floor((new Date(card.endDate).getTime() - Date.now()) / 86400000));
    const remainMonths = Math.max(1, Math.ceil(remainDays / 30));
    const nextMonth = Math.ceil(remainNeed / remainMonths);

    const messages = [
      `嫌课贵就多打卡！下月冲${nextMonth}节，轻松把单价拉回${target}元目标～`,
      `缺课亏大啦！下个月补${nextMonth}节，把钱和进度都赚回来！`,
      `每多上一节，单价就降一点～下月目标${nextMonth}节，行动起来！`
    ];

    res.json({
      result: {
        need, totalDone, remainNeed, remainDays, remainMonths, nextMonth,
        message: messages[Math.floor(Math.random() * messages.length)]
      }
    });
  } catch (err) {
    res.status(500).json({ error: '计算失败' });
  }
});

module.exports = router;
