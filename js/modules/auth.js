// 舞力打卡 - 模块1: 账户体系 (Cloudflare API版)
// v8.4 服务器端验证码 + D1 数据存储

// ---- 登录流程控制 ----
// 页面加载时检查是否已登录（在app-core.js的init中处理）
App.loadAuth = async function() {
  console.log('[AUTH] loaded');
  // 默认展示「登录」界面（手机号 + 登录码）
  _showStep3();
};

// 显示步骤1：输入手机号
function _showStep1() {
  document.getElementById('authStep1').style.display = 'block';
  document.getElementById('authStep2').style.display = 'none';
  document.getElementById('authStep3').style.display = 'none';
  document.getElementById('authStep4').style.display = 'none';
}

// 显示步骤2：显示生成的登录码
function _showStep2(code) {
  document.getElementById('authStep1').style.display = 'none';
  document.getElementById('authStep2').style.display = 'block';
  document.getElementById('authStep3').style.display = 'none';
  document.getElementById('authStep4').style.display = 'none';
  document.getElementById('displayCode').textContent = code;
}

// 显示步骤3：输入手机号+登录码登录
function _showStep3() {
  document.getElementById('authStep1').style.display = 'none';
  document.getElementById('authStep2').style.display = 'none';
  document.getElementById('authStep3').style.display = 'block';
  document.getElementById('authStep4').style.display = 'none';
}

// 显示步骤4：忘记登录码
function _showStep4() {
  document.getElementById('authStep1').style.display = 'none';
  document.getElementById('authStep2').style.display = 'none';
  document.getElementById('authStep3').style.display = 'none';
  document.getElementById('authStep4').style.display = 'block';
}

// ---- 注册：生成登录码（仅限新手机号）----
async function _doRegister() {
  const phone = document.getElementById('authPhone')?.value?.trim();

  // 验证手机号
  if (!phone || phone.length !== 11 || !/^1[3-9]\d{9}$/.test(phone)) {
    UI.toast('请输入正确的手机号', 'err');
    return;
  }

  try {
    UI.toast('正在生成登录码...', 'ok');
    const data = await API.post('/api/auth/register', { phone });

    // 保存token到本地（自动登录）
    U.setToken(data.token);
    App.user = data.user;

    // 显示生成的登录码
    _showStep2(data.code);

    console.log('[AUTH] 注册成功:', data.user.nickname);
  } catch (e) {
    // 手机号已注册：引导去登录（不覆盖旧登录码）
    if (e.message && e.message.indexOf('已注册') !== -1) {
      UI.toast('该手机号已注册，请直接登录', 'err');
      const p2 = document.getElementById('authPhone2');
      if (p2) p2.value = phone;
      _showStep3();
      return;
    }
    UI.toast(e.message || '注册失败', 'err');
  }
}

// ---- 找回登录码 ----
async function _doRecover() {
  const phone = document.getElementById('authPhoneRecover')?.value?.trim();

  if (!phone || phone.length !== 11 || !/^1[3-9]\d{9}$/.test(phone)) {
    UI.toast('请输入正确的手机号', 'err');
    return;
  }

  try {
    UI.toast('正在找回...', 'ok');
    const data = await API.post('/api/auth/recover', { phone });
    // 展示找回的登录码
    document.getElementById('recoverCode').textContent = data.code;
    document.getElementById('recoverResult').style.display = 'block';
    console.log('[AUTH] 找回成功');
  } catch (e) {
    UI.toast(e.message || '该手机号未注册', 'err');
  }
}

// ---- 步骤2：完成注册（自动登录成功）----
async function _finishRegister() {
  try {
    // 已经在 _doRegister 中自动登录了，加载舞蹈卡
    await App._loadActiveCard();
    await App.nav('home');
    UI.toast('欢迎来到舞力打卡！', 'ok');
  } catch (e) {
    console.error('[AUTH] finish register error:', e);
    UI.toast('进入首页失败，请重试', 'err');
  }
}

// ---- 步骤3：登录验证（调服务器API）----
async function __login() {
  const phone = document.getElementById('authPhone2')?.value?.trim();
  const code = document.getElementById('authCode')?.value?.trim();

  if (!phone || phone.length !== 11 || !/^1[3-9]\d{9}$/.test(phone)) {
    UI.toast('请输入正确的手机号', 'err');
    return;
  }

  if (!code || code.length !== 6) {
    UI.toast('请输入6位登录码', 'err');
    return;
  }

  try {
    const data = await API.post('/api/auth/login', { phone, code });

    // 保存token
    U.setToken(data.token);
    App.user = data.user;

    // 加载舞蹈卡并进入首页
    await App._loadActiveCard();
    await App.nav('home');
    UI.toast('登录成功！', 'ok');
    console.log('[AUTH] login success:', data.user.nickname);
  } catch (e) {
    UI.toast(e.message || '手机号或登录码错误', 'err');
  }
}

// ---- 忘记登录码（进入找回界面）----
function _showForget() {
  const r = document.getElementById('recoverResult');
  if (r) r.style.display = 'none';
  const rc = document.getElementById('recoverCode');
  if (rc) rc.textContent = '------';
  _showStep4();
}

// ---- 返回步骤1（重新注册）----
function _backToStep1() {
  U.clearToken();
  App.user = null;
  App.card = null;
  _showStep1();
}

// ---- 退出登录（调服务器API）----
async function _doLogout() {
  const ok = await UI.modal('退出登录', '确定要退出登录吗？', '退出', '取消');
  if (!ok) return;

  try { await API.logout(); } catch (e) { /* ignore */ }

  U.clearToken();
  App.user = null;
  App.card = null;
  await App.nav('auth');
  UI.toast('已退出', 'ok');
}

// ---- 个人中心 ----
App.loadProfile = async function() {
  const container = document.getElementById('profileContent');
  if (!container) { console.error('[PROFILE] container not found'); return; }

  const u = this.user;
  if (!u) {
    container.innerHTML = UI.empty('👤', '请先登录');
    return;
  }
  container.innerHTML = `
    <div class="prof-top">
      <div class="prof-av">${u.avatar ? `<img src="${u.avatar}" style="width:72px;height:72px;border-radius:50%;object-fit:cover">` : '<svg width="32" height="32" style="color:#fff"><use href="#i-user"/></svg>'}</div>
      <div class="prof-nick" id="profNick">${u.nickname || '未设置'}</div>
      <div class="prof-lv" id="profLevel">
        ${(u.danceTypes || []).join(' · ') || '未设置舞种'} ·
        ${({beginner:'入门',elementary:'初级',intermediate:'中级',advanced:'高级'})[u.danceLevel] || '入门'}
      </div>
      <div class="prof-phone">登录手机：${maskPhone(u.phone || '')}</div>
    </div>
    <div class="card" style="padding:4px 0">
      <div class="prof-mi" onclick="App.nav('profileEdit')"><div class="prof-mi-left"><span class="prof-mi-ico"><svg width="18" height="18" style="color:var(--clr)"><use href="#i-edit"/></svg></span>编辑资料</div><span style="color:var(--t3)">›</span></div>
      <div class="prof-mi" onclick="App.nav('achievements')"><div class="prof-mi-left"><span class="prof-mi-ico"><svg width="18" height="18" style="color:var(--orange)"><use href="#i-trophy"/></svg></span>成就徽章</div><span style="color:var(--t3)">›</span></div>
      <div class="prof-mi" onclick="App.nav('card')"><div class="prof-mi-left"><span class="prof-mi-ico"><svg width="18" height="18" style="color:var(--clr)"><use href="#i-card"/></svg></span>我的舞蹈卡</div><span style="color:var(--t3)">›</span></div>
      <div class="prof-mi" onclick="App.nav('schedule')"><div class="prof-mi-left"><span class="prof-mi-ico"><svg width="18" height="18" style="color:var(--accent)"><use href="#i-cal"/></svg></span>课表管理</div><span style="color:var(--t3)">›</span></div>
      <div class="prof-mi" onclick="App.nav('recover')"><div class="prof-mi-left"><span class="prof-mi-ico"><svg width="18" height="18" style="color:var(--orange)"><use href="#i-magic"/></svg></span>缺课补救</div><span style="color:var(--t3)">›</span></div>
      <div class="prof-mi" onclick="App.nav('checkinHistory')"><div class="prof-mi-left"><span class="prof-mi-ico"><svg width="18" height="18" style="color:var(--green)"><use href="#i-chart"/></svg></span>打卡记录</div><span style="color:var(--t3)">›</span></div>
      <div class="prof-mi" onclick="App.nav('reminders')"><div class="prof-mi-left"><span class="prof-mi-ico"><svg width="18" height="18" style="color:#f59e0b"><use href="#i-magic"/></svg></span>提醒设置</div><span style="color:var(--t3)">›</span></div>
    </div>
    <button class="prof-logout-btn" onclick="_doLogout()">退出登录</button>
    <div class="prof-out" onclick="App._resetData()">清空我的数据</div>
    <div class="prof-out" onclick="App._handleAccountDelete()">注销账号</div>
  `;
};

// ---- 清空我的数据（保留账号与登录态）----
App._resetData = async function() {
  const ok = await UI.modal('清空数据', '将删除你的舞蹈卡、打卡记录和课表，恢复到初始空白状态。账号和登录码保留。确定吗？', '清空', '取消');
  if (!ok) return;
  try {
    await API.resetData();
    this.card = null;
    UI.toast('数据已清空，可以重新导入课表啦', 'ok');
    await this.nav('home');
  } catch (e) {
    UI.toast(e.message || '清空失败', 'err');
  }
};

// 手机号打码显示：138****8888
function maskPhone(p) {
  if (!p || p.length < 7) return p || '未绑定';
  return p.slice(0, 3) + '****' + p.slice(-4);
}

// ---- 编辑资料 ----
App.loadProfileEdit = async function() {
  const container = document.getElementById('editProfileContent');
  if (!container) { console.error('[PROFILEEDIT] container not found'); return; }

  const u = this.user;
  if (!u) return;
  container.innerHTML = `
    <div class="sec-title">编辑资料</div>
    <div class="card">
      <div class="inp-g">
        <label class="inp-l">昵称</label>
        <input class="inp" id="editNick" value="${u.nickname || ''}">
      </div>
      <div class="inp-g">
        <label class="inp-l">舞蹈水平</label>
        <select class="inp" id="editLevel">
          <option value="beginner" ${u.danceLevel==='beginner'?'selected':''}>入门</option>
          <option value="elementary" ${u.danceLevel==='elementary'?'selected':''}>初级</option>
          <option value="intermediate" ${u.danceLevel==='intermediate'?'selected':''}>中级</option>
          <option value="advanced" ${u.danceLevel==='advanced'?'selected':''}>高级</option>
          <option value="professional" ${u.danceLevel==='professional'?'selected':''}>专业</option>
        </select>
      </div>
      <div class="inp-g">
        <label class="inp-l">常用舞种 (多选)</label>
        <div id="editTypes">
          ${['Jazz','Hiphop','K-pop','舞蹈通识','芭蕾','现代舞','拉丁','中国舞','街舞'].map(t =>
            `<span class="chip ${(u.danceTypes||[]).includes(t)?'on':''}" data-t="${t}" onclick="this.classList.toggle('on')">${t}</span>`
          ).join('')}
        </div>
      </div>
      <div class="inp-g">
        <label class="inp-l">空闲时段 (多选)</label>
        <div id="editFree">
          ${[
            {v:'mon-eve',l:'周一晚'},{v:'tue-eve',l:'周二晚'},{v:'wed-eve',l:'周三晚'},
            {v:'thu-eve',l:'周四晚'},{v:'fri-eve',l:'周五晚'},{v:'sat-day',l:'周六全天'},
            {v:'sun-day',l:'周日全天'}
          ].map(f =>
            `<span class="chip ${(u.freeTime||[]).includes(f.v)?'on':''}" data-f="${f.v}" onclick="this.classList.toggle('on')">${f.l}</span>`
          ).join('')}
        </div>
      </div>
    </div>
    <button class="btn btn-p btn-b" onclick="App._saveProfile()">保存</button>
  `;
};

// ---- 成就徽章 ----
App.loadAchievements = async function() {
  const container = document.getElementById('achContent');
  if (!container) { console.error('[ACH] container not found'); return; }

  try {
    const data = await API.getAchievements();
    const list = data.achievements || [];
    if (list.length === 0) {
      container.innerHTML = UI.empty('🏆', '暂无成就', '完成课程打卡即可解锁徽章');
      return;
    }
    const earned = list.filter(a => a.earned).length;
    container.innerHTML = `
      <div class="sec-title">我的成就</div>
      <div class="card" style="text-align:center;padding:16px;margin-bottom:14px">
        <div style="font-size:30px;font-weight:800;color:var(--orange)">${earned}</div>
        <div style="font-size:12px;color:var(--t3)">已解锁 / 共 ${list.length} 枚徽章</div>
      </div>
      <div class="ach-grid">
        ${list.map(a => `
          <div class="ach-badge ${a.earned ? 'earned' : 'locked'}">
            <div class="ach-ico">${a.icon || '🏅'}</div>
            <div class="ach-name">${a.name}</div>
            <div class="ach-desc">${a.desc || ''}</div>
            <div class="ach-state">${a.earned ? '已解锁' : '未解锁'}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = UI.empty('⚠️', '成就加载失败', e.message);
  }
};

App._saveProfile = async function() {
  const nickname = document.getElementById('editNick').value.trim() || this.user.nickname;
  const danceLevel = document.getElementById('editLevel').value;
  const danceTypes = [...document.querySelectorAll('#editTypes .chip.on')].map(c => c.dataset.t);
  const freeTime = [...document.querySelectorAll('#editFree .chip.on')].map(c => c.dataset.f);
  try {
    const data = await API.updateProfile({ nickname, danceLevel, danceTypes, freeTime });
    this.user = data.user;
    UI.toast('保存成功!', 'ok');
    await this.nav('profile');
  } catch (e) {
    UI.toast(e.message || '保存失败', 'err');
  }
};

// ---- 注销账号 ----
App._handleAccountDelete = async function() {
  const ok = await UI.modal('⚠️ 危险操作', '注销后所有数据将永久删除，不可恢复！确定要继续吗？', '确认注销', '取消');
  if (!ok) return;
  const confirm2 = await UI.modal('再次确认', '请输入 注销 两字确认', '注销', '取消');
  if (!confirm2) return;

  try {
    await API.deleteAccount();
    U.clearToken();
    App.user = null;
    App.card = null;
    await App.nav('auth');
    UI.toast('账号已注销', 'ok');
  } catch (e) {
    UI.toast(e.message || '注销失败', 'err');
  }
};
