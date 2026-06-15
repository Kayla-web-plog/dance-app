// 舞力打卡 - 课表模板API路由
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// 需要认证
router.use(authMiddleware);

// GET /api/templates - 获取所有课表模板
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const templates = db.prepare('SELECT * FROM templates ORDER BY weekday, time').all();
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: '获取课表失败' });
  }
});

// GET /api/templates/week - 按周查询课程
router.get('/week', (req, res) => {
  try {
    const { start, end } = req.query;
    const db = getDb();
    const templates = db.prepare('SELECT * FROM templates ORDER BY weekday, time').all();

    // 按周编排课程
    const startDate = new Date(start || new Date());
    const endDate = new Date(end || new Date());
    const days = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const courses = templates.filter(t => t.weekday === wd);
      days.push({ date: dateStr, weekday: wd, courses });
    }

    res.json({ days });
  } catch (err) {
    res.status(500).json({ error: '获取周课表失败' });
  }
});

// GET /api/templates/:id - 获取单个模板
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: '课程不存在' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: '获取课程失败' });
  }
});

// POST /api/templates - 添加课程模板
router.post('/', (req, res) => {
  try {
    const { weekday, time, courseName, teacher, danceType, level } = req.body;
    if (weekday === undefined || weekday < 0 || weekday > 6) {
      return res.status(400).json({ error: '请选择正确的星期' });
    }
    if (!courseName || !courseName.trim()) {
      return res.status(400).json({ error: '课程名称不能为空' });
    }
    const db = getDb();
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO templates (weekday, time, courseName, teacher, danceType, level, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(weekday, time || '', courseName, teacher || '', danceType || '', level || '', now, now);
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: '添加课程失败' });
  }
});

// PUT /api/templates/:id - 更新课程
router.put('/:id', (req, res) => {
  try {
    const { weekday, time, courseName, teacher, danceType, level } = req.body;
    const db = getDb();
    const now = Date.now();
    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '课程不存在' });

    db.prepare(`UPDATE templates SET weekday=?, time=?, courseName=?, teacher=?, danceType=?, level=?, updatedAt=? WHERE id=?`)
      .run(
        weekday ?? existing.weekday,
        time ?? existing.time,
        courseName ?? existing.courseName,
        teacher ?? existing.teacher,
        danceType ?? existing.danceType,
        level ?? existing.level,
        now,
        req.params.id
      );
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: '更新失败' });
  }
});

// DELETE /api/templates/:id - 删除课程
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败' });
  }
});

// POST /generate - 智能排课 (挂载到 /api/smart 时路径为 /api/smart/generate)
router.post('/generate', (req, res) => {
  try {
    const { target, preferredTypes } = req.body;
    const db = getDb();
    let templates = db.prepare('SELECT * FROM templates ORDER BY weekday, time').all();

    // 按偏好舞种过滤
    if (preferredTypes && preferredTypes.length > 0) {
      templates = templates.filter(t => preferredTypes.includes(t.danceType));
    }

    // 按空闲时段排序（优先匹配用户空闲时间）
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    const freeTime = JSON.parse(user?.freeTime || '[]');
    const wdMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

    templates.sort((a, b) => {
      const aMatch = freeTime.some(f => f.includes(wdMap[a.weekday])) ? 1 : 0;
      const bMatch = freeTime.some(f => f.includes(wdMap[b.weekday])) ? 1 : 0;
      return bMatch - aMatch;
    });

    const safeTarget = Number(target) || 5;
    const matched = templates.slice(0, Math.max(safeTarget * 2, 10));
    const total = templates.length;
    const warning = total < safeTarget
      ? `⚠️ 仅匹配${total}节，目标${safeTarget}节，单价可能上涨！建议调整空闲时段。`
      : null;

    res.json({ matched, total, target: safeTarget, warning });
  } catch (err) {
    console.error('[SMART] error:', err);
    res.status(500).json({ error: '生成专属课表失败' });
  }
});

module.exports = router;
