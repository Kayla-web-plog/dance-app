// 轻量测试：用 Module 拦截替换 db 与 middleware，直接验证 auth 路由逻辑
const Module = require('module');
const path = require('path');

// ---- 内存假数据库 ----
const users = []; // {id, phone, loginCode, nickname, danceLevel, danceTypes, freeTime}
let seq = 0;
function fakePrepare(sql) {
  return {
    get(...args) {
      // 模拟真实 DB：每次返回行的拷贝（避免调用方 mutate 影响存储）
      let found;
      if (/FROM users WHERE phone/.test(sql)) {
        found = users.find(u => u.phone === args[0]);
      } else if (/FROM users WHERE id/.test(sql)) {
        found = users.find(u => u.id === args[0]);
      }
      return found ? { ...found } : undefined;
    },
    run(...args) {
      if (/INSERT INTO users/.test(sql)) {
        const [phone, nickname, danceLevel, danceTypes, freeTime, loginCode] = args;
        const u = { id: ++seq, phone, nickname, danceLevel, danceTypes, freeTime, loginCode };
        users.push(u);
        return { lastInsertRowid: u.id };
      }
      return { changes: 1 };
    }
  };
}
const fakeDb = { prepare: fakePrepare };

// ---- 拦截 require ----
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../db') return { getDb: () => fakeDb };
  if (request === '../middleware/auth') return {
    generateToken: () => 'tok-' + Math.random().toString(36).slice(2),
    authMiddleware: (req, res, next) => next(),
  };
  return origLoad.apply(this, arguments);
};

const routerPath = path.join(__dirname, '..', 'server', 'routes', 'auth.js');
const router = require(routerPath);

// ---- 从 express router 中找到 handler ----
function findHandler(method, routePath) {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === routePath && layer.route.methods[method]) {
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }
  }
  throw new Error('handler not found: ' + method + ' ' + routePath);
}

function call(method, routePath, body) {
  return new Promise((resolve) => {
    const handler = findHandler(method, routePath);
    const req = { body };
    const res = {
      _status: 200,
      status(c) { this._status = c; return this; },
      json(o) { resolve({ status: this._status, body: o }); },
    };
    handler(req, res);
  });
}

// ---- 测试用例 ----
(async () => {
  let pass = 0, fail = 0;
  const check = (name, cond, extra) => {
    if (cond) { pass++; console.log('  ✅ ' + name); }
    else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
  };

  const PHONE = '13800138000';

  console.log('\n[1] 首次注册（新手机号）应生成登录码');
  const r1 = await call('post', '/register', { phone: PHONE });
  check('返回 200', r1.status === 200, r1);
  check('返回 6 位登录码', /^\d{6}$/.test(r1.body.code || ''), r1.body);
  const savedCode = r1.body.code;

  console.log('\n[2] 重复注册（同手机号）应被拦截，不覆盖登录码');
  const r2 = await call('post', '/register', { phone: PHONE });
  check('返回 400', r2.status === 400, r2);
  check('提示已注册', (r2.body.error || '').indexOf('已注册') !== -1, r2.body);
  check('数据库登录码未变', users[0].loginCode === savedCode, { db: users[0].loginCode, saved: savedCode });

  console.log('\n[3] 用正确登录码登录成功');
  const r3 = await call('post', '/login', { phone: PHONE, code: savedCode });
  check('返回 200', r3.status === 200, r3);
  check('返回 token', !!r3.body.token, r3.body);

  console.log('\n[4] 用错误登录码登录失败');
  const r4 = await call('post', '/login', { phone: PHONE, code: '000000' });
  check('返回 400', r4.status === 400, r4);
  check('提示登录码错误', (r4.body.error || '').indexOf('登录码错误') !== -1, r4.body);

  console.log('\n[5] 找回登录码，返回原码');
  const r5 = await call('post', '/recover', { phone: PHONE });
  check('返回 200', r5.status === 200, r5);
  check('返回的码 = 注册时的码', r5.body.code === savedCode, { got: r5.body.code, want: savedCode });

  console.log('\n[6] 找回未注册手机号应报错');
  const r6 = await call('post', '/recover', { phone: '13900139000' });
  check('返回 400', r6.status === 400, r6);
  check('提示未注册', (r6.body.error || '').indexOf('未注册') !== -1, r6.body);

  console.log('\n========================================');
  console.log(`结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
