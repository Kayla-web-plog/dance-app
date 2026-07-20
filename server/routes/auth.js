// 舞力打卡 - 账户API路由
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

// POST /api/auth/guest - 免登录体验
router.post('/guest', (req, res) => {
  try {
    const db = getDb();
    const guestPhone = '10000000000';
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(guestPhone);
    if (!user) {
      const now = Date.now();
      const result = db.prepare(`
        INSERT INTO users (phone, nickname, danceLevel, danceTypes, freeTime, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(guestPhone, '体验用户', 'intermediate',
        '["Jazz","K-pop","Hiphop","舞蹈通识"]',
        '["wed-eve","thu-eve","fri-eve","sat-day","sun-day"]',
        now, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      console.log('[AUTH] guest created:', user.id);
    }
    // 确保体验用户有默认舞蹈卡
    const card = db.prepare('SELECT id FROM cards WHERE userId = ? AND status = ?').get(user.id, 'active');
    if (!card) {
      const now = Date.now();
      const todayDate = new Date();
      const startStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,'0')}-${String(todayDate.getDate()).padStart(2,'0')}`;
      const endDate = new Date(Date.now() + 180 * 86400000);
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,'0')}-${String(endDate.getDate()).padStart(2,'0')}`;
      db.prepare(`INSERT INTO cards (userId, name, type, totalPrice, targetPrice, startDate, endDate, usedLessons, status, createdAt, updatedAt)
        VALUES (?, '半年卡', 'period', 4800, 40, ?, ?, 0, 'active', ?, ?)`)
        .run(user.id, startStr, endStr, now, now);
      console.log('[AUTH] guest card created:', startStr, '->', endStr);
    }

    // 确保有默认课程模板
    const tplCount = db.prepare('SELECT COUNT(*) as cnt FROM templates').get().cnt;
    if (tplCount === 0) {
      const now = Date.now();
      const defaultTemplates = [
        { weekday: 3, time: '19:00-20:30', courseName: 'Jazz A', teacher: '', danceType: 'Jazz', level: 'intermediate' },
        { weekday: 5, time: '19:00-20:30', courseName: 'Hiphop Basic', teacher: '', danceType: 'Hiphop', level: 'beginner' },
        { weekday: 0, time: '14:00-15:10', courseName: 'K-pop Cover', teacher: '', danceType: 'K-pop', level: 'intermediate' },
        { weekday: 4, time: '19:30-21:00', courseName: '舞蹈通识', teacher: '', danceType: '舞蹈通识', level: 'beginner' },
        { weekday: 6, time: '10:00-11:30', courseName: 'Jazz B', teacher: '', danceType: 'Jazz', level: 'advanced' },
      ];
      const stmt = db.prepare('INSERT INTO templates (weekday, time, courseName, teacher, danceType, level, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)');
      for (const t of defaultTemplates) {
        stmt.run(t.weekday, t.time, t.courseName, t.teacher, t.danceType, t.level, now, now);
      }
      console.log('[AUTH] default templates created:', defaultTemplates.length);
    }

    user.danceTypes = JSON.parse(user.danceTypes || '[]');
    user.freeTime = JSON.parse(user.freeTime || '[]');
    const token = generateToken(user.id);
    console.log('[AUTH] guest login:', user.id);
    res.json({ token, user });
  } catch (err) {
    console.error('[AUTH] guest error:', err);
    res.status(500).json({ error: '体验登录失败' });
  }
});

// POST /api/auth/register - 注册并生成6位登录码（前端契约：返回 {token,user,code}）
router.post('/register', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确手机号' });
    }
    const db = getDb();
    // 生成6位登录码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
      const now = Date.now();
      const result = db.prepare(`
        INSERT INTO users (phone, nickname, danceLevel, danceTypes, freeTime, loginCode, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(phone, '舞者' + phone.slice(-4), 'beginner', '[]', '[]', code, now, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      console.log('[AUTH] register new user:', user.id, phone, 'code=', code);
    } else {
      // 已存在则重置登录码（用于找回）
      db.prepare('UPDATE users SET loginCode = ?, updatedAt = ? WHERE id = ?').run(code, Date.now(), user.id);
      user.loginCode = code;
      console.log('[AUTH] register reset code for user:', user.id, 'code=', code);
    }
    user.danceTypes = JSON.parse(user.danceTypes || '[]');
    user.freeTime = JSON.parse(user.freeTime || '[]');
    const token = generateToken(user.id);
    res.json({ token, user, code });
  } catch (err) {
    console.error('[AUTH] register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login - 手机号+登录码登录
router.post('/login', (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !/^1\d{10}$/.test(phone)) {
      return res.status(400).json({ error: '请输入正确手机号' });
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
      return res.status(400).json({ error: '该手机号未注册，请先注册' });
    }
    if (!code || code !== user.loginCode) {
      return res.status(400).json({ error: '登录码错误' });
    }

    // 解析JSON字段
    user.danceTypes = JSON.parse(user.danceTypes || '[]');
    user.freeTime = JSON.parse(user.freeTime || '[]');

    const token = generateToken(user.id);
    console.log('[AUTH] login success:', user.id, phone);
    res.json({ token, user });
  } catch (err) {
    console.error('[AUTH] login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// GET /api/users/profile - 获取用户资料
router.get('/profile', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    user.danceTypes = JSON.parse(user.danceTypes || '[]');
    user.freeTime = JSON.parse(user.freeTime || '[]');
    res.json({ user });
  } catch (err) {
    console.error('[PROFILE] get error:', err);
    res.status(500).json({ error: '获取资料失败' });
  }
});

// PUT /api/users/profile - 更新用户资料
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { nickname, danceLevel, danceTypes, freeTime } = req.body;
    const db = getDb();
    const now = Date.now();
    db.prepare(`
      UPDATE users SET nickname=?, danceLevel=?, danceTypes=?, freeTime=?, updatedAt=?
      WHERE id=?
    `).run(
      nickname || '',
      danceLevel || 'beginner',
      JSON.stringify(danceTypes || []),
      JSON.stringify(freeTime || []),
      now,
      req.userId
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    user.danceTypes = JSON.parse(user.danceTypes || '[]');
    user.freeTime = JSON.parse(user.freeTime || '[]');
    console.log('[PROFILE] updated:', req.userId, nickname);
    res.json({ user });
  } catch (err) {
    console.error('[PROFILE] update error:', err);
    res.status(500).json({ error: '更新资料失败' });
  }
});

// POST /api/auth/logout - 注销
router.post('/logout', authMiddleware, (req, res) => {
  // 客户端清除Token即可，服务端无需操作
  res.json({ success: true });
});

// DELETE /api/users/account - 注销账号
router.delete('/account', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    // 删除用户相关数据
    const cards = db.prepare('SELECT id FROM cards WHERE userId = ?').all(req.userId);
    const cardIds = cards.map(c => c.id);
    if (cardIds.length > 0) {
      const placeholders = cardIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM checkins WHERE cardId IN (${placeholders})`).run(...cardIds);
      db.prepare(`DELETE FROM cards WHERE userId = ?`).run(req.userId);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
    console.log('[ACCOUNT] deleted:', req.userId);
    res.json({ success: true, message: '账号已注销' });
  } catch (err) {
    console.error('[ACCOUNT] delete error:', err);
    res.status(500).json({ error: '注销失败' });
  }
});

module.exports = router;
