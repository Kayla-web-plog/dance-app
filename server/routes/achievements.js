// 舞力打卡 - 成就API路由
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/achievements - 获取成就数据
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const cards = db.prepare('SELECT id, totalPrice, targetPrice FROM cards WHERE userId = ?').all(req.userId);

    if (cards.length === 0) {
      return res.json({ achievements: [] });
    }

    let totalDone = 0;
    let maxStreak = 0;
    let perfectStreak = 0;
    let totalSaved = 0;
    const allCheckins = [];
    let allDoneDates = [];  // 跨卡连续打卡
    let allAbsentDates = new Set(); // 跨卡缺课日期
    let fullMonth = false;

    for (const card of cards) {
      const cks = db.prepare('SELECT courseDate, status, stars FROM checkins WHERE cardId = ? ORDER BY courseDate').all(card.id);
      allCheckins.push(...cks.map(c => ({...c, cardId: card.id})));
      const done = cks.filter(c => c.status === 'done');
      allDoneDates.push(...done.map(c => c.courseDate));
      cks.filter(c => c.status === 'absent').forEach(c => allAbsentDates.add(c.courseDate));
      totalDone += done.length;

      // 连续五星
      let perfect = 0;
      for (let i = done.length - 1; i >= 0; i--) {
        if (done[i].stars >= 5) perfect++;
        else break;
      }
      perfectStreak = Math.max(perfectStreak, perfect);

      const target = card.targetPrice || 40;
      totalSaved += Math.max(0, target * done.length - card.totalPrice);
    }

    // 跨卡连续打卡计算
    const dates = [...new Set(allDoneDates)].sort();
    let curStreak = dates.length > 0 ? 1 : 0;
    maxStreak = Math.max(maxStreak, curStreak);
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.floor((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
      if (diff === 1) curStreak++;
      else curStreak = 1;
      maxStreak = Math.max(maxStreak, curStreak);
    }

    // 全勤月检测：是否存在一个月每天都有打卡且无缺课
    const today = new Date();
    for (let m = 1; m <= today.getMonth() + 1; m++) {
      const daysInMonth = new Date(today.getFullYear(), m, 0).getDate();
      let fullCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${today.getFullYear()}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if (dates.includes(ds) && !allAbsentDates.has(ds)) fullCount++;
      }
      if (daysInMonth >= 28 && fullCount >= 20) { fullMonth = true; break; }
    }

    const targetReached = cards.some(c => {
      const done = allCheckins.filter(ck => ck.status === 'done' && ck.cardId === c.id).length;
      return done >= Math.ceil(c.totalPrice / (c.targetPrice || 40));
    });

    const achievements = [
      { id: 'streak7', name: '连续7天', icon: '🔥', earned: maxStreak >= 7, desc: '连续打卡7天' },
      { id: 'streak30', name: '连续30天', icon: '⚡', earned: maxStreak >= 30, desc: '连续打卡30天' },
      { id: 'fullMonth', name: '全勤月', icon: '🌟', earned: fullMonth, desc: '一个月出勤率超70%' },
      { id: 'targetReached', name: '达标课时', icon: '🎯', earned: targetReached, desc: '完成目标总课时' },
      { id: 'saved100', name: '省钱达人', icon: '💰', earned: totalSaved >= 100, desc: '累计省钱超100元' },
      { id: 'saved1000', name: '省钱大师', icon: '💎', earned: totalSaved >= 1000, desc: '累计省钱超1000元' },
      { id: '50lessons', name: '50节课', icon: '🏅', earned: totalDone >= 50, desc: '累计完成50节课' },
      { id: '100lessons', name: '100节课', icon: '👑', earned: totalDone >= 100, desc: '累计完成100节课' },
      { id: 'perfect10', name: '十全十美', icon: '💫', earned: perfectStreak >= 10, desc: '连续10次五星好评' }
    ];

    res.json({ achievements });
  } catch (err) {
    console.error('[ACHIEVEMENTS] error:', err);
    res.status(500).json({ error: '获取成就失败' });
  }
});

// GET /api/achievements/summary - 简版摘要 (用于分享页)
router.get('/summary', (req, res) => {
  try {
    const db = getDb();
    const cards = db.prepare('SELECT id, name, totalPrice, targetPrice FROM cards WHERE userId = ? AND status = ? ORDER BY createdAt DESC').all(req.userId, 'active');
    const card = cards[0] || null;

    if (!card) {
      return res.json({ summary: { hasCard: false } });
    }

    const checkins = db.prepare('SELECT status FROM checkins WHERE cardId = ?').all(card.id);
    const done = checkins.filter(c => c.status === 'done').length;
    const total = checkins.length;

    res.json({
      summary: {
        hasCard: true,
        cardName: card.name,
        totalPrice: card.totalPrice,
        targetPrice: card.targetPrice,
        totalDone: done,
        rate: total > 0 ? Math.round(done / total * 100) + '%' : '0%'
      }
    });
  } catch (err) {
    res.status(500).json({ error: '获取摘要失败' });
  }
});

module.exports = router;
