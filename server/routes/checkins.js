// 舞力打卡 - 打卡记录API路由
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// POST /api/checkins - 创建打卡记录
router.post('/', (req, res) => {
  try {
    const { cardId, templateId, courseName, status, photo, location, note, video, stars, tags, absentReason } = req.body;
    const db = getDb();

    // 验证卡片归属
    const card = db.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').get(cardId, req.userId);
    if (!card) return res.status(400).json({ error: '舞蹈卡不存在' });

    const now = Date.now();
    // 支持补卡：如果提供了courseDate则使用，否则默认今天
    let courseDate = req.body.courseDate;
    if (!courseDate || !/^\d{4}-\d{2}-\d{2}$/.test(courseDate)) {
      const today = new Date();
      courseDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    }

    const result = db.prepare(`
      INSERT INTO checkins (cardId, templateId, courseDate, courseName, status, absentReason,
        photo, location, note, video, stars, tags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cardId, templateId || null, courseDate, courseName || '',
      status || 'done', absentReason || '',
      photo || '', location || '', note || '', video || '',
      stars || 0, JSON.stringify(tags || []),
      now, now
    );

    // 更新卡片已上课时
    if (status === 'done') {
      db.prepare('UPDATE cards SET usedLessons = usedLessons + 1, updatedAt = ? WHERE id = ?').run(now, cardId);
    }

    const checkin = db.prepare('SELECT * FROM checkins WHERE id = ?').get(result.lastInsertRowid);
    console.log('[CHECKIN] created:', result.lastInsertRowid, status);
    res.json({ checkin });
  } catch (err) {
    console.error('[CHECKIN] create error:', err);
    res.status(500).json({ error: '创建打卡记录失败' });
  }
});

// PUT /api/checkins/:id - 修改打卡记录
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM checkins WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '记录不存在' });
    // 验证归属
    const card = db.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').get(existing.cardId, req.userId);
    if (!card) return res.status(403).json({ error: '无权修改' });

    const { courseName, note, stars, tags, photo, video } = req.body;
    const now = Date.now();
    // 如果状态从非done改为done，增加usedLessons
    if (existing.status !== 'done' && (req.body.status === 'done')) {
      db.prepare('UPDATE cards SET usedLessons = usedLessons + 1, updatedAt = ? WHERE id = ?').run(now, existing.cardId);
    }
    // 如果从done改为非done，减少usedLessons
    if (existing.status === 'done' && req.body.status && req.body.status !== 'done') {
      db.prepare('UPDATE cards SET usedLessons = MAX(0, usedLessons - 1), updatedAt = ? WHERE id = ?').run(now, existing.cardId);
    }

    db.prepare(`UPDATE checkins SET courseName=?, note=?, stars=?, tags=?, photo=?, video=?, updatedAt=? WHERE id=?`)
      .run(courseName ?? existing.courseName, note ?? existing.note, stars ?? existing.stars,
        tags ? JSON.stringify(tags) : existing.tags, photo ?? existing.photo, video ?? existing.video,
        now, req.params.id);
    const checkin = db.prepare('SELECT * FROM checkins WHERE id = ?').get(req.params.id);
    console.log('[CHECKIN] updated:', req.params.id);
    res.json({ checkin });
  } catch (err) {
    console.error('[CHECKIN] update error:', err);
    res.status(500).json({ error: '修改失败' });
  }
});

// DELETE /api/checkins/:id - 删除打卡记录
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM checkins WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '记录不存在' });
    const card = db.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').get(existing.cardId, req.userId);
    if (!card) return res.status(403).json({ error: '无权删除' });

    // 如果是done状态，减少usedLessons
    if (existing.status === 'done') {
      db.prepare('UPDATE cards SET usedLessons = MAX(0, usedLessons - 1), updatedAt = ? WHERE id = ?').run(Date.now(), existing.cardId);
    }
    db.prepare('DELETE FROM checkins WHERE id = ?').run(req.params.id);
    console.log('[CHECKIN] deleted:', req.params.id, existing.courseDate, existing.courseName);
    res.json({ success: true });
  } catch (err) {
    console.error('[CHECKIN] delete error:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// GET /api/checkins - 获取打卡记录列表
router.get('/', (req, res) => {
  try {
    const { cardId, limit } = req.query;
    const db = getDb();
    let query = 'SELECT * FROM checkins WHERE cardId IN (SELECT id FROM cards WHERE userId = ?)';
    const params = [req.userId];

    if (cardId) {
      // 验证cardId属于当前用户
      const card = db.prepare('SELECT id FROM cards WHERE id = ? AND userId = ?').get(cardId, req.userId);
      if (!card) return res.status(403).json({ error: '无权访问该舞蹈卡' });
      query = 'SELECT * FROM checkins WHERE cardId = ?';
      params[0] = cardId;
    }
    query += ' ORDER BY courseDate DESC';
    const limitNum = parseInt(limit);
    if (limitNum > 0 && limitNum <= 1000) query += ` LIMIT ${limitNum}`;

    const checkins = db.prepare(query).all(...params);
    res.json({ checkins });
  } catch (err) {
    res.status(500).json({ error: '获取打卡记录失败' });
  }
});

// GET /api/checkins/calendar - 日历视图数据
router.get('/calendar', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const db = getDb();

    const cards = db.prepare('SELECT id FROM cards WHERE userId = ?').all(req.userId);
    const cardIds = cards.map(c => c.id);

    let days = [];
    let stats = { done: 0, absent: 0, rate: '0%' };

    if (cardIds.length > 0) {
      const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
      const lastDay = new Date(year, month, 0);
      const lastDayStr = `${year}-${String(month).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;

      const checkins = db.prepare(`
        SELECT courseDate, status FROM checkins
        WHERE cardId IN (${cardIds.map(() => '?').join(',')})
        AND courseDate >= ? AND courseDate <= ?
      `).all(...cardIds, firstDay, lastDayStr);

      const checkinMap = {};
      checkins.forEach(c => { checkinMap[c.courseDate] = c; });

      // 生成日历数据
      const startDay = (new Date(year, month - 1, 1).getDay() + 7) % 7;
      const daysInMonth = lastDay.getDate();
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

      for (let i = 0; i < startDay; i++) days.push(null);

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const ck = checkinMap[dateStr];
        days.push({
          day: d, date: dateStr,
          status: ck ? ck.status : null,
          isToday: dateStr === todayStr
        });
      }

      const doneC = checkins.filter(c => c.status === 'done').length;
      const totalC = checkins.length;

      stats = {
        done: doneC,
        absent: checkins.filter(c => c.status === 'absent').length,
        total: totalC,
        rate: totalC > 0 ? Math.round(doneC / totalC * 100) + '%' : '0%'
      };
    }

    res.json({ calendar: { year, month, days, stats } });
  } catch (err) {
    console.error('[CALENDAR] error:', err);
    res.status(500).json({ error: '获取日历数据失败' });
  }
});

// GET /api/checkins/statistics - 统计数据
router.get('/statistics', (req, res) => {
  try {
    const db = getDb();
    const cards = db.prepare('SELECT id, totalPrice, targetPrice FROM cards WHERE userId = ?').all(req.userId);
    let totalDone = 0, totalAbsent = 0, totalPrice = 0, targetPrice = 40;

    for (const card of cards) {
      const cks = db.prepare('SELECT status, stars FROM checkins WHERE cardId = ?').all(card.id);
      totalDone += cks.filter(c => c.status === 'done').length;
      totalAbsent += cks.filter(c => c.status === 'absent').length;
      totalPrice = card.totalPrice || totalPrice;
      targetPrice = card.targetPrice || targetPrice;
    }

    const totalCheckins = totalDone + totalAbsent;
    res.json({
      statistics: {
        totalDone,
        totalAbsent,
        rate: totalCheckins > 0 ? Math.round(totalDone / totalCheckins * 100) + '%' : '0%',
        totalPrice,
        targetPrice,
        actualPrice: totalDone > 0 ? totalPrice / totalDone : 0,
        saved: Math.max(0, targetPrice * totalDone - totalPrice)
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

module.exports = router;
