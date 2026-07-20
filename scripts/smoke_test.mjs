const BASE = 'http://localhost:3099';
const h = (t) => ({ 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) });
const post = async (p, b, t) => { const r = await fetch(BASE + p, { method: 'POST', headers: h(t), body: JSON.stringify(b) }); return { s: r.status, j: await r.json() }; };
const get = async (p, t) => { const r = await fetch(BASE + p, { headers: h(t) }); return { s: r.status, j: await r.json() }; };

const reg = await post('/api/auth/register', { phone: '13800138000' });
console.log('register      :', reg.s, '| code=', reg.j.code, '| token?', !!reg.j.token);
const token = reg.j.token, code = reg.j.code;

const loginBad = await post('/api/auth/login', { phone: '13800138000', code: '000000' });
console.log('login wrong   :', loginBad.s, '|', loginBad.j.error);
const login = await post('/api/auth/login', { phone: '13800138000', code });
console.log('login right   :', login.s, '| nick=', login.j.user?.nickname);

const card = await post('/api/cards', { name: '测试半年卡', type: 'period', totalPrice: 4800, targetPrice: 0, startDate: '2026-07-17', endDate: '2027-01-13' }, token);
console.log('create card   :', card.s, '| id=', card.j.card?.id);
const cid = card.j.card.id;

const ck = await post('/api/checkins', { cardId: cid, courseName: 'Jazz A', status: 'done', stars: 5, photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', tags: ['test'] }, token);
console.log('checkin+photo :', ck.s, '| id=', ck.j.checkin?.id, '| photoLen=', ck.j.checkin?.photo?.length);

const stats = await get('/api/checkins/statistics', token);
console.log('statistics    :', stats.s, '|', JSON.stringify(stats.j.statistics));
const cal = await get('/api/checkins/calendar?year=2026&month=7', token);
console.log('calendar      :', cal.s, '|', JSON.stringify(cal.j.calendar?.stats));
const tpl = await get('/api/templates', token);
console.log('templates     :', tpl.s, '| count=', tpl.j.templates?.length);
const ach = await get('/api/achievements', token);
console.log('achievements  :', ach.s, '| count=', ach.j.achievements?.length);
const sm = await post('/api/smart/generate', { target: 5, preferredTypes: ['Jazz'] }, token);
console.log('smart gen     :', sm.s, '| matched=', sm.j.matched?.length);
