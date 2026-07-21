// 舞力打卡 - Cloudflare Pages Functions 后端 (v8.5 修复版)
// 处理所有 /api/* 路由，使用 D1 数据库 + R2 文件存储

// ---------- 辅助函数 ----------
function json(data, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  return new Response(JSON.stringify(data), { status, headers });
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

// 从 Authorization header 获取 userId
async function getUserId(req, env) {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const result = await env.DB.prepare('SELECT userId FROM sessions WHERE token = ?').bind(token).first();
  return result ? result.userId : null;
}

// 生成随机 token
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'cf_' + token;
}

// 确保需要认证的路由有 userId
// 返回：{ userId } 成功；{ error: Response } 失败
async function requireAuth(req, env) {
  const userId = await getUserId(req, env);
  if (!userId) return { error: json({ error: '未登录或登录已过期' }, 401) };
  return { userId };
}

// 解析请求体
async function getBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ---------- 主入口 ----------
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization'
      }
    });
  }

  // API 路由匹配
  try {

    // GET /api/health
    if (path === '/api/health' && method === 'GET') {
      return json({ status: 'ok', db: 'connected' });
    }

    // POST /api/auth/register - 仅新手机号可注册生成登录码
    if (path === '/api/auth/register' && method === 'POST') {
      const { phone } = await getBody(request);
      if (!phone || !/^1\d{10}$/.test(phone)) return error('请输入正确手机号');
      const now = Date.now();
      const existing = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
      if (existing) return error('该手机号已注册，请直接登录');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await env.DB.prepare(`
        INSERT INTO users (phone, nickname, danceLevel, danceTypes, freeTime, loginCode, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(phone, '舞者' + phone.slice(-4), 'beginner', JSON.stringify([]), JSON.stringify([]), code, now, now).run();
      const row = await env.DB.prepare('SELECT last_insert_rowid() as id').first();
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.id).first();
      const token = generateToken();
      await env.DB.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)').bind(token, user.id, now).run();
      user.danceTypes = JSON.parse(user.danceTypes || '[]');
      user.freeTime = JSON.parse(user.freeTime || '[]');
      delete user.loginCode;
      return json({ token, user, code });
    }

    // POST /api/auth/recover - 凭手机号找回登录码
    if (path === '/api/auth/recover' && method === 'POST') {
      const { phone } = await getBody(request);
      if (!phone || !/^1\d{10}$/.test(phone)) return error('请输入正确手机号');
      const user = await env.DB.prepare('SELECT loginCode FROM users WHERE phone = ?').bind(phone).first();
      if (!user) return error('该手机号未注册，请先生成登录码');
      return json({ code: user.loginCode });
    }

    // POST /api/auth/login
    if (path === '/api/auth/login' && method === 'POST') {
      const { phone, code } = await getBody(request);
      if (!phone || !/^1\d{10}$/.test(phone)) return error('请输入正确手机号');
      const user = await env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
      if (!user) return error('该手机号未注册，请先生成登录码');
      if (user.loginCode !== code) return error('登录码错误');
      const token = generateToken();
      await env.DB.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)').bind(token, user.id, Date.now()).run();
      user.danceTypes = JSON.parse(user.danceTypes || '[]');
      user.freeTime = JSON.parse(user.freeTime || '[]');
      delete user.loginCode;
      return json({ token, user });
    }

    // POST /api/auth/logout
    if (path === '/api/auth/logout' && method === 'POST') {
      const auth = request.headers.get('Authorization');
      if (auth && auth.startsWith('Bearer ')) {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(auth.slice(7)).run();
      }
      return json({ success: true });
    }

    // POST /api/auth/guest
    if (path === '/api/auth/guest' && method === 'POST') {
      const guestPhone = '10000000000';
      const now = Date.now();
      let user = await env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(guestPhone).first();
      if (!user) {
        await env.DB.prepare(`
          INSERT INTO users (phone, nickname, danceLevel, danceTypes, freeTime, loginCode, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(guestPhone, '体验用户', 'intermediate',
          JSON.stringify(['Jazz','K-pop','Hiphop','舞蹈通识']),
          JSON.stringify(['wed-eve','thu-eve','fri-eve','sat-day','sun-day']),
          '000000', now, now).run();
        const row = await env.DB.prepare('SELECT last_insert_rowid() as id').first();
        user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.id).first();
        await env.DB.prepare(`
          INSERT INTO cards (userId, name, type, totalPrice, targetPrice, startDate, endDate, usedLessons, status, createdAt, updatedAt)
          VALUES (?, '半年卡', 'period', 4800, 40, ?, ?, 0, 'active', ?, ?)
        `).bind(user.id, new Date().toISOString().slice(0,10),
          new Date(Date.now() + 180 * 86400000).toISOString().slice(0,10), now, now).run();
      }
      const token = generateToken();
      await env.DB.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)').bind(token, user.id, now).run();
      user.danceTypes = JSON.parse(user.danceTypes || '[]');
      user.freeTime = JSON.parse(user.freeTime || '[]');
      delete user.loginCode;
      return json({ token, user });
    }

    // ===== 用户路由 =====
    // GET /api/users/profile
    if (path === '/api/users/profile' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first();
      if (!user) return error('用户不存在', 404);
      user.danceTypes = JSON.parse(user.danceTypes || '[]');
      user.freeTime = JSON.parse(user.freeTime || '[]');
      delete user.loginCode;
      return json({ user });
    }

    // PUT /api/users/profile
    if (path === '/api/users/profile' && method === 'PUT') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const { nickname, danceLevel, danceTypes, freeTime } = await getBody(request);
      const now = Date.now();
      await env.DB.prepare(`
        UPDATE users SET nickname=?, danceLevel=?, danceTypes=?, freeTime=?, updatedAt=?
        WHERE id=?
      `).bind(nickname || '', danceLevel || 'beginner', JSON.stringify(danceTypes || []), JSON.stringify(freeTime || []), now, auth.userId).run();
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first();
      user.danceTypes = JSON.parse(user.danceTypes || '[]');
      user.freeTime = JSON.parse(user.freeTime || '[]');
      delete user.loginCode;
      return json({ user });
    }

    // DELETE /api/users/account
    if (path === '/api/users/account' && method === 'DELETE') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const cards = await env.DB.prepare('SELECT id FROM cards WHERE userId = ?').bind(auth.userId).all();
      for (const c of cards.results) {
        await env.DB.prepare('DELETE FROM checkins WHERE cardId = ?').bind(c.id).run();
      }
      await env.DB.prepare('DELETE FROM cards WHERE userId = ?').bind(auth.userId).run();
      await env.DB.prepare('DELETE FROM sessions WHERE userId = ?').bind(auth.userId).run();
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(auth.userId).run();
      return json({ success: true, message: '账号已注销' });
    }

    // POST /api/data/reset - 清空当前用户的个人数据（保留账号与登录态）
    if (path === '/api/data/reset' && method === 'POST') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      // 删除该用户的打卡记录（通过 cards 关联）
      await env.DB.prepare('DELETE FROM checkins WHERE cardId IN (SELECT id FROM cards WHERE userId = ?)').bind(auth.userId).run();
      // 删除该用户的舞蹈卡
      await env.DB.prepare('DELETE FROM cards WHERE userId = ?').bind(auth.userId).run();
      // 清空课程目录（舞蹈室课表），让用户重新导入自己的课表
      await env.DB.prepare('DELETE FROM templates').run();
      return json({ success: true, message: '数据已清空' });
    }

    // ===== 舞蹈卡路由 =====
    // GET /api/cards/stats
    if (path === '/api/cards/stats' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const card = await env.DB.prepare('SELECT * FROM cards WHERE userId = ? AND status = ? ORDER BY createdAt DESC').bind(auth.userId, 'active').first();
      if (!card) return json({ stats: { hasCard: false } });
      const checkins = await env.DB.prepare('SELECT status FROM checkins WHERE cardId = ?').bind(card.id).all();
      const done = checkins.results.filter(c => c.status === 'done').length;
      const used = card.usedLessons ?? done;
      const target = (card.targetPrice && card.targetPrice > 0) ? card.targetPrice : 0;
      const need = target > 0 ? Math.ceil(card.totalPrice / target) : 0;
      const remain = card.endDate ? Math.max(0, Math.floor((new Date(card.endDate + 'T23:59:59').getTime() - Date.now()) / 86400000)) : 365;
      const actual = (used > 0 && need > 0) ? card.totalPrice / used : 0;
      const progress = need > 0 ? Math.min(100, Math.round((used / need) * 100)) : 0;
      const remainMonths = Math.max(1, Math.ceil(remain / 30));
      return json({
        stats: {
          hasCard: true, cardName: card.name, cardType: card.type,
          totalPrice: card.totalPrice, targetPrice: target, hasTarget: target > 0,
          used, remainDays: remain, actualPrice: actual, need, progress,
          weeklyTarget: Math.ceil(need / (remainMonths * 4)),
          totalSessions: card.totalSessions, startDate: card.startDate, endDate: card.endDate
        }
      });
    }

    // GET /api/cards
    if (path === '/api/cards' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const cards = await env.DB.prepare('SELECT * FROM cards WHERE userId = ? ORDER BY createdAt DESC').bind(auth.userId).all();
      return json({ cards: cards.results });
    }

    // POST /api/cards
    if (path === '/api/cards' && method === 'POST') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const { name, type, totalPrice, targetPrice, startDate, endDate, totalSessions } = await getBody(request);
      const now = Date.now();
      await env.DB.prepare(`
        INSERT INTO cards (userId, name, type, totalPrice, targetPrice, startDate, endDate, totalSessions, usedLessons, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)
      `).bind(auth.userId, name || '我的舞蹈卡', type || 'period', totalPrice || 0, targetPrice || 40,
        startDate || null, endDate || null, totalSessions || 0, now, now).run();
      const row = await env.DB.prepare('SELECT last_insert_rowid() as id').first();
      const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(row.id).first();
      return json({ card });
    }

    // 匹配 /api/cards/:id
    const cardIdMatch = path.match(/^\/api\/cards\/(\d+)$/);
    if (cardIdMatch) {
      const cardId = parseInt(cardIdMatch[1]);
      if (method === 'GET') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').bind(cardId, auth.userId).first();
        if (!card) return error('舞蹈卡不存在', 404);
        return json({ card });
      }
      if (method === 'PUT') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        const data = await getBody(request);
        const existing = await env.DB.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').bind(cardId, auth.userId).first();
        if (!existing) return error('舞蹈卡不存在', 404);
        const now = Date.now();
        await env.DB.prepare(`
          UPDATE cards SET name=?, type=?, totalPrice=?, targetPrice=?, endDate=?, totalSessions=?, status=?, updatedAt=?
          WHERE id=?
        `).bind(data.name || existing.name, data.type || existing.type, data.totalPrice ?? existing.totalPrice,
          data.targetPrice ?? existing.targetPrice, data.endDate || existing.endDate,
          data.totalSessions ?? existing.totalSessions, data.status || existing.status, now, cardId).run();
        const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first();
        return json({ card });
      }
      if (method === 'DELETE') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        await env.DB.prepare('DELETE FROM checkins WHERE cardId = ?').bind(cardId).run();
        await env.DB.prepare('DELETE FROM cards WHERE id = ? AND userId = ?').bind(cardId, auth.userId).run();
        return json({ success: true });
      }
    }

    // PUT /api/cards/target - 设置/更新期望课单价（快捷入口）
    if (path === '/api/cards/target' && method === 'PUT') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const { targetPrice } = await getBody(request);
      if (!targetPrice || targetPrice <= 0) return error('期望课单价必须大于0');
      const card = await env.DB.prepare('SELECT * FROM cards WHERE userId = ? AND status = ? ORDER BY createdAt DESC').bind(auth.userId, 'active').first();
      if (!card) return error('没有激活的舞蹈卡，请先创建');
      const now = Date.now();
      await env.DB.prepare('UPDATE cards SET targetPrice = ?, updatedAt = ? WHERE id = ?').bind(targetPrice, now, card.id).run();
      const updated = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(card.id).first();
      return json({ success: true, card: updated });
    }

    // POST /api/cards/recover
    if (path === '/api/cards/recover' && method === 'POST') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const { thisMonth } = await getBody(request);
      const card = await env.DB.prepare('SELECT * FROM cards WHERE userId = ? AND status = ? ORDER BY createdAt DESC').bind(auth.userId, 'active').first();
      if (!card) return error('没有激活的舞蹈卡');
      const checkins = await env.DB.prepare('SELECT status FROM checkins WHERE cardId = ?').bind(card.id).all();
      const totalDone = checkins.results.filter(c => c.status === 'done').length + (parseInt(thisMonth) || 0);
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
      return json({
        result: { need, totalDone, remainNeed, remainDays, remainMonths, nextMonth,
          message: messages[Math.floor(Math.random() * messages.length)] }
      });
    }

    // ===== 打卡路由 =====
    // GET /api/checkins/calendar
    if (path === '/api/checkins/calendar' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const year = parseInt(url.searchParams.get('year')) || new Date().getFullYear();
      const month = parseInt(url.searchParams.get('month')) || (new Date().getMonth() + 1);
      const cards = await env.DB.prepare('SELECT id FROM cards WHERE userId = ?').bind(auth.userId).all();
      const cardIds = cards.results.map(c => c.id);
      if (cardIds.length === 0) return json({ calendar: { year, month, days: [], stats: { done: 0, absent: 0, rate: '0%' } } });
      const firstDay = `${year}-${String(month).padStart(2,'0')}-01`;
      const lastDay = new Date(year, month, 0);
      const lastDayStr = `${year}-${String(month).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
      const placeholders = cardIds.map(() => '?').join(',');
      const checkins = await env.DB.prepare(`
        SELECT courseDate, status FROM checkins
        WHERE cardId IN (${placeholders}) AND courseDate >= ? AND courseDate <= ?
      `).bind(...cardIds, firstDay, lastDayStr).all();
      const checkinMap = {};
      checkins.results.forEach(c => { checkinMap[c.courseDate] = c; });
      const startDay = (new Date(year, month - 1, 1).getDay() + 7) % 7;
      const daysInMonth = lastDay.getDate();
      const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
      const days = [];
      for (let i = 0; i < startDay; i++) days.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const ck = checkinMap[dateStr];
        days.push({ day: d, date: dateStr, status: ck ? ck.status : null, isToday: dateStr === todayStr });
      }
      const doneC = checkins.results.filter(c => c.status === 'done').length;
      const totalC = checkins.results.length;
      return json({ calendar: { year, month, days, stats: { done: doneC, absent: checkins.results.filter(c => c.status === 'absent').length, total: totalC, rate: totalC > 0 ? Math.round(doneC / totalC * 100) + '%' : '0%' } } });
    }

    // GET /api/checkins/statistics
    if (path === '/api/checkins/statistics' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const cards = await env.DB.prepare('SELECT id, totalPrice, targetPrice FROM cards WHERE userId = ?').bind(auth.userId).all();
      let totalDone = 0, totalAbsent = 0, totalPrice = 0, targetPrice = 40;
      for (const card of cards.results) {
        const cks = await env.DB.prepare('SELECT status FROM checkins WHERE cardId = ?').bind(card.id).all();
        totalDone += cks.results.filter(c => c.status === 'done').length;
        totalAbsent += cks.results.filter(c => c.status === 'absent').length;
        totalPrice = card.totalPrice || totalPrice;
        targetPrice = card.targetPrice || targetPrice;
      }
      const totalCheckins = totalDone + totalAbsent;
      return json({ statistics: { totalDone, totalAbsent, rate: totalCheckins > 0 ? Math.round(totalDone / totalCheckins * 100) + '%' : '0%', totalPrice, targetPrice, actualPrice: totalDone > 0 ? totalPrice / totalDone : 0, saved: Math.max(0, targetPrice * totalDone - totalPrice) } });
    }

    // GET /api/checkins
    if (path === '/api/checkins' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const cardId = url.searchParams.get('cardId');
      let query, params;
      if (cardId) {
        query = 'SELECT * FROM checkins WHERE cardId = ? ORDER BY courseDate DESC';
        params = [cardId];
      } else {
        query = 'SELECT * FROM checkins WHERE cardId IN (SELECT id FROM cards WHERE userId = ?) ORDER BY courseDate DESC';
        params = [auth.userId];
      }
      const limit = parseInt(url.searchParams.get('limit'));
      if (limit > 0 && limit <= 1000) query += ' LIMIT ' + limit;
      const checkins = await env.DB.prepare(query).bind(...params).all();
      return json({ checkins: checkins.results });
    }

    // POST /api/checkins
    if (path === '/api/checkins' && method === 'POST') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const data = await getBody(request);
      const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').bind(data.cardId, auth.userId).first();
      if (!card) return error('舞蹈卡不存在');
      const now = Date.now();
      let courseDate = data.courseDate;
      if (!courseDate || !/^\d{4}-\d{2}-\d{2}$/.test(courseDate)) {
        const today = new Date();
        courseDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      }
      await env.DB.prepare(`
        INSERT INTO checkins (cardId, templateId, courseDate, courseName, status, absentReason, photo, location, note, video, stars, tags, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(data.cardId, data.templateId || null, courseDate, data.courseName || '',
        data.status || 'done', data.absentReason || '', data.photo || '', data.location || '',
        data.note || '', data.video || '', data.stars || 0, JSON.stringify(data.tags || []), now, now).run();
      if (data.status === 'done') {
        await env.DB.prepare('UPDATE cards SET usedLessons = usedLessons + 1, updatedAt = ? WHERE id = ?').bind(now, data.cardId).run();
      }
      const row = await env.DB.prepare('SELECT last_insert_rowid() as id').first();
      const checkin = await env.DB.prepare('SELECT * FROM checkins WHERE id = ?').bind(row.id).first();
      return json({ checkin });
    }

    // 匹配 /api/checkins/:id
    const ciMatch = path.match(/^\/api\/checkins\/(\d+)$/);
    if (ciMatch) {
      const ciId = parseInt(ciMatch[1]);
      if (method === 'PUT') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        const data = await getBody(request);
        const existing = await env.DB.prepare('SELECT * FROM checkins WHERE id = ?').bind(ciId).first();
        if (!existing) return error('记录不存在', 404);
        const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').bind(existing.cardId, auth.userId).first();
        if (!card) return error('无权修改', 403);
        const now = Date.now();
        if (existing.status !== 'done' && data.status === 'done') {
          await env.DB.prepare('UPDATE cards SET usedLessons = usedLessons + 1, updatedAt = ? WHERE id = ?').bind(now, existing.cardId).run();
        }
        if (existing.status === 'done' && data.status && data.status !== 'done') {
          await env.DB.prepare('UPDATE cards SET usedLessons = MAX(0, usedLessons - 1), updatedAt = ? WHERE id = ?').bind(now, existing.cardId).run();
        }
        await env.DB.prepare(`UPDATE checkins SET courseName=?, note=?, stars=?, tags=?, photo=?, video=?, updatedAt=? WHERE id=?`)
          .bind(data.courseName ?? existing.courseName, data.note ?? existing.note, data.stars ?? existing.stars,
            JSON.stringify(data.tags ?? JSON.parse(existing.tags || '[]')), data.photo ?? existing.photo,
            data.video ?? existing.video, now, ciId).run();
        const checkin = await env.DB.prepare('SELECT * FROM checkins WHERE id = ?').bind(ciId).first();
        return json({ checkin });
      }
      if (method === 'DELETE') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        const existing = await env.DB.prepare('SELECT * FROM checkins WHERE id = ?').bind(ciId).first();
        if (!existing) return error('记录不存在', 404);
        const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ? AND userId = ?').bind(existing.cardId, auth.userId).first();
        if (!card) return error('无权删除', 403);
        if (existing.status === 'done') {
          await env.DB.prepare('UPDATE cards SET usedLessons = MAX(0, usedLessons - 1), updatedAt = ? WHERE id = ?').bind(Date.now(), existing.cardId).run();
        }
        await env.DB.prepare('DELETE FROM checkins WHERE id = ?').bind(ciId).run();
        return json({ success: true });
      }
    }

    // ===== 课表模板路由 =====
    // GET /api/templates/week
    if (path === '/api/templates/week' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const templates = await env.DB.prepare('SELECT * FROM templates ORDER BY weekday, time').all();
      const startParam = url.searchParams.get('start');
      const endParam = url.searchParams.get('end');
      const startDate = startParam ? new Date(startParam) : (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d; })();
      const endDate = endParam ? new Date(endParam) : (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d; })();
      const days = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const wd = d.getDay();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const courses = templates.results.filter(t => t.weekday === wd);
        days.push({ date: dateStr, weekday: wd, courses });
      }
      return json({ days });
    }

    // GET /api/templates
    if (path === '/api/templates' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const templates = await env.DB.prepare('SELECT * FROM templates ORDER BY weekday, time').all();
      return json({ templates: templates.results });
    }

    // POST /api/templates
    if (path === '/api/templates' && method === 'POST') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const { weekday, time, courseName, teacher, danceType, level } = await getBody(request);
      if (weekday === undefined || weekday < 0 || weekday > 6) return error('请选择正确的星期');
      if (!courseName || !courseName.trim()) return error('课程名称不能为空');
      const now = Date.now();
      await env.DB.prepare(`
        INSERT INTO templates (weekday, time, courseName, teacher, danceType, level, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(weekday, time || '', courseName, teacher || '', danceType || '', level || '', now, now).run();
      const row = await env.DB.prepare('SELECT last_insert_rowid() as id').first();
      const template = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(row.id).first();
      return json({ template });
    }

    // 匹配 /api/templates/:id
    const tpMatch = path.match(/^\/api\/templates\/(\d+)$/);
    if (tpMatch) {
      const tpId = parseInt(tpMatch[1]);
      if (method === 'GET') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        const template = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(tpId).first();
        if (!template) return error('课程不存在', 404);
        return json({ template });
      }
      if (method === 'PUT') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        const data = await getBody(request);
        const existing = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(tpId).first();
        if (!existing) return error('课程不存在', 404);
        const now = Date.now();
        await env.DB.prepare(`UPDATE templates SET weekday=?, time=?, courseName=?, teacher=?, danceType=?, level=?, updatedAt=? WHERE id=?`)
          .bind(data.weekday ?? existing.weekday, data.time ?? existing.time, data.courseName ?? existing.courseName,
            data.teacher ?? existing.teacher, data.danceType ?? existing.danceType, data.level ?? existing.level, now, tpId).run();
        const template = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(tpId).first();
        return json({ template });
      }
      if (method === 'DELETE') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;
        await env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(tpId).run();
        return json({ success: true });
      }
    }

    // POST /api/smart/generate
    if (path === '/api/smart/generate' && method === 'POST') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const { target, preferredTypes } = await getBody(request);
      const templates = await env.DB.prepare('SELECT * FROM templates ORDER BY weekday, time').all();
      let matched = templates.results;
      if (preferredTypes && preferredTypes.length > 0) {
        matched = matched.filter(t => preferredTypes.includes(t.danceType));
      }
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first();
      const freeTime = JSON.parse(user?.freeTime || '[]');
      const wdMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
      matched.sort((a, b) => {
        const aMatch = freeTime.some(f => f.includes(wdMap[a.weekday])) ? 1 : 0;
        const bMatch = freeTime.some(f => f.includes(wdMap[b.weekday])) ? 1 : 0;
        return bMatch - aMatch;
      });
      const safeTarget = Number(target) || 5;
      const finalMatched = matched.slice(0, Math.max(safeTarget * 2, 10));
      const total = matched.length;
      const warning = total < safeTarget ? `⚠️ 仅匹配${total}节，目标${safeTarget}节，单价可能上涨！建议调整空闲时段。` : null;
      return json({ matched: finalMatched, total, target: safeTarget, warning });
    }

    // ===== 成就路由 =====
    // GET /api/achievements
    if (path === '/api/achievements' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const cards = await env.DB.prepare('SELECT id, totalPrice, targetPrice FROM cards WHERE userId = ?').bind(auth.userId).all();
      if (cards.results.length === 0) return json({ achievements: [] });
      let totalDone = 0, maxStreak = 0, perfectStreak = 0, totalSaved = 0;
      const allCheckins = [];
      const allDoneDates = [];
      const allAbsentDates = new Set();
      for (const card of cards.results) {
        const cks = await env.DB.prepare('SELECT courseDate, status, stars FROM checkins WHERE cardId = ? ORDER BY courseDate').bind(card.id).all();
        const done = cks.results.filter(c => c.status === 'done');
        allCheckins.push(...cks.results);
        allDoneDates.push(...done.map(c => c.courseDate));
        cks.results.filter(c => c.status === 'absent').forEach(c => allAbsentDates.add(c.courseDate));
        totalDone += done.length;
        let perfect = 0;
        for (let i = done.length - 1; i >= 0; i--) {
          if (done[i].stars >= 5) perfect++; else break;
        }
        perfectStreak = Math.max(perfectStreak, perfect);
        totalSaved += Math.max(0, (card.targetPrice || 40) * done.length - card.totalPrice);
      }
      const dates = [...new Set(allDoneDates)].sort();
      let curStreak = dates.length > 0 ? 1 : 0;
      maxStreak = Math.max(maxStreak, curStreak);
      for (let i = 1; i < dates.length; i++) {
        const diff = Math.floor((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
        if (diff === 1) curStreak++; else curStreak = 1;
        maxStreak = Math.max(maxStreak, curStreak);
      }
      let fullMonth = false;
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
      const targetReached = cards.results.some(c => {
        const doneCards = allCheckins.filter(ck => ck.status === 'done' && ck.cardId === c.id).length;
        return doneCards >= Math.ceil(c.totalPrice / (c.targetPrice || 40));
      });
      return json({
        achievements: [
          { id: 'streak7', name: '连续7天', icon: '🔥', earned: maxStreak >= 7, desc: '连续打卡7天' },
          { id: 'streak30', name: '连续30天', icon: '⚡', earned: maxStreak >= 30, desc: '连续打卡30天' },
          { id: 'fullMonth', name: '全勤月', icon: '🌟', earned: fullMonth, desc: '一个月出勤率超70%' },
          { id: 'targetReached', name: '达标课时', icon: '🎯', earned: targetReached, desc: '完成目标总课时' },
          { id: 'saved100', name: '省钱达人', icon: '💰', earned: totalSaved >= 100, desc: '累计省钱超100元' },
          { id: 'saved1000', name: '省钱大师', icon: '💎', earned: totalSaved >= 1000, desc: '累计省钱超1000元' },
          { id: '50lessons', name: '50节课', icon: '🏅', earned: totalDone >= 50, desc: '累计完成50节课' },
          { id: '100lessons', name: '100节课', icon: '🎖', earned: totalDone >= 100, desc: '累计完成100节课' },
          { id: 'perfect10', name: '十全十美', icon: '💫', earned: perfectStreak >= 10, desc: '连续10次五星好评' }
        ]
      });
    }

    // GET /api/achievements/summary
    if (path === '/api/achievements/summary' && method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      const card = await env.DB.prepare('SELECT id, name, totalPrice, targetPrice FROM cards WHERE userId = ? AND status = ? ORDER BY createdAt DESC').bind(auth.userId, 'active').first();
      if (!card) return json({ summary: { hasCard: false } });
      const checkins = await env.DB.prepare('SELECT status FROM checkins WHERE cardId = ?').bind(card.id).all();
      const done = checkins.results.filter(c => c.status === 'done').length;
      const total = checkins.results.length;
      return json({ summary: { hasCard: true, cardName: card.name, totalPrice: card.totalPrice, targetPrice: card.targetPrice, totalDone: done, rate: total > 0 ? Math.round(done / total * 100) + '%' : '0%' } });
    }

    return error('API路径不存在: ' + method + ' ' + path, 404);
  } catch (err) {
    console.error('[WORKER ERROR]', err.message, err.stack);
    return error('服务器内部错误: ' + err.message, 500);
  }
}

export default {
  async fetch(request, env) {
    return onRequest({ request, env });
  }
};
