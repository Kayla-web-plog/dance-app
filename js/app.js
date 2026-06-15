// 舞力打卡 - 应用主入口
const App = {
  user: null,
  card: null,
  route: 'auth',
  hist: ['home'],

  // ---- 导航 ----
  async nav(route, params) {
    console.log(`[NAV] → ${route}`, params || '');
    
    // 登录检查
    if (route !== 'auth' && !this.user) {
      console.log('[NAV] no user, redirect to auth');
      this._show('auth');
      return;
    }
    if (route === 'auth' && this.user) {
      this._show('home');
      return;
    }

    this.route = route;
    this._show(route);

    // 更新标题
    const titles = {
      home: '舞力打卡', auth: '登录',
      card: '我的舞蹈卡', cardForm: '创建舞蹈卡',
      recover: '缺课补救',
      schedule: '课表管理', smartSchedule: '专属课表',
      checkin: '打卡', checkinHistory: '打卡记录',
      share: '分享', achievements: '成就徽章',
      profile: '我的', profileEdit: '编辑资料'
    };
    document.getElementById('headerTitle').textContent = titles[route] || '舞力打卡';
    document.getElementById('btnBack').style.display =
      ['home', 'auth'].includes(route) ? 'none' : 'block';

    this.hist.push(route);

    // 更新Tab高亮
    const tabMap = {
      home: 'home', card: 'home', cardForm: 'home', recover: 'home',
      schedule: 'schedule', smartSchedule: 'schedule',
      checkin: 'checkin', checkinHistory: 'checkin',
      share: 'share', achievements: 'share',
      profile: 'profile', profileEdit: 'profile',
      auth: 'profile'
    };
    document.querySelectorAll('.tb-i').forEach(t =>
      t.classList.toggle('on', t.dataset.r === (tabMap[route] || 'home'))
    );

    // 加载页面数据
    try {
      switch (route) {
        case 'home': await this.loadHome(); break;
        case 'card': await this.loadCards(); break;
        case 'cardForm': await this.loadCardForm(params); break;
        case 'schedule': await this.loadSchedule(); break;
        case 'smartSchedule': await this.loadSmart(); break;
        case 'checkin': await this.loadCheckin(params); break;
        case 'checkinHistory': await this.loadHistory(); break;
        case 'share': await this.loadShare(); break;
        case 'achievements': await this.loadAchievements(); break;
        case 'profile': await this.loadProfile(); break;
        case 'profileEdit': await this.loadProfileEdit(); break;
        case 'recover': await this.loadRecover(); break;
        default: console.log('[NAV] no loader for route:', route);
      }
    } catch (e) {
      console.error(`[NAV] error loading ${route}:`, e);
      // 显示错误到页面容器
      const container = document.getElementById(route + 'Content') || document.getElementById('pg-' + route);
      if (container && container.innerHTML === '') {
        container.innerHTML = UI.empty('❌', '页面加载失败', e.message);
      }
    }

    window.scrollTo(0, 0);
  },

  goBack() {
    this.hist.pop();
    const prev = this.hist[this.hist.length - 1] || 'home';
    this.nav(prev);
  },

  _show(route) {
    document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
    const el = document.getElementById('pg-' + route);
    if (el) {
      el.classList.add('on');
      console.log('[SHOW] page shown:', route);
    } else {
      console.error('[SHOW] page element not found for route:', route);
    }
  },

  // ---- 初始化 ----
  async init() {
    console.log('=== 舞力打卡 v2.0 初始化 ===');

    // 绑定全局函数（必须在页面渲染前）
    window._doLogin = (phone, code) => this._handleLogin(phone, code);
    window._doGuest = () => this._handleGuest();
    window._sendCode = () => this._handleSendCode();
    window._doLogout = () => this._handleLogout();

    // 自动恢复登录
    const token = U.getToken();
    if (token) {
      try {
        const data = await API.getProfile();
        this.user = data.user;
        // 自动加载第一张舞蹈卡
        await this._loadActiveCard();
        console.log('[INIT] auto-login success:', this.user.nickname);
      } catch (e) {
        console.log('[INIT] auto-login failed, clearing token:', e.message);
        U.clearToken();
        this.user = null;
        this.card = null;
      }
    }

    // 确保首页container存在再渲染
    await this.nav(this.user ? 'home' : 'auth');
    console.log('[INIT] ready, route:', this.route);
  },

  // ---- 登录逻辑 ----
  async _handleLogin(phone, code) {
    if (!/^1\d{10}$/.test(phone)) { UI.toast('请输入正确手机号', 'err'); return; }
    if (code !== '1234') { UI.toast('验证码错误 (演示:1234)', 'err'); return; }
    try {
      const data = await API.login(phone, code);
      U.setToken(data.token);
      this.user = data.user;
      await this._loadActiveCard();
      await this.nav('home');
      UI.toast('登录成功!', 'ok');
      console.log('[LOGIN] success:', this.user.id);
    } catch (e) {
      UI.toast(e.message || '登录失败', 'err');
    }
  },

  async _handleGuest() {
    try {
      const data = await API.guestLogin();
      U.setToken(data.token);
      this.user = data.user;
      await this._loadActiveCard();
      await this.nav('home');
      UI.toast('欢迎体验！数据可保留', 'ok');
      console.log('[GUEST] login:', this.user.id);
    } catch (e) {
      UI.toast(e.message || '体验登录失败', 'err');
    }
  },

  // 加载当前激活的舞蹈卡
  async _loadActiveCard() {
    try {
      const data = await API.getCardStats();
      if (data.stats && data.stats.hasCard) {
        // 获取完整卡列表，取第一张active卡
        const cardsData = await API.getCards();
        const active = (cardsData.cards || []).find(c => c.status === 'active');
        if (active) {
          this.card = active;
          console.log('[CARD] loaded:', active.name, active.id);
        }
      }
    } catch (e) {
      console.log('[CARD] load failed:', e.message);
    }
  },

  _handleSendCode() {
    const phone = document.getElementById('authPhone')?.value?.trim();
    if (!/^1\d{10}$/.test(phone)) { UI.toast('请输入正确手机号', 'err'); return; }
    UI.toast('验证码已发送 (演示:1234)', 'ok');
    const btn = document.getElementById('authSendCode');
    if (!btn) return;
    let s = 60;
    btn.disabled = true;
    const t = setInterval(() => {
      s--;
      btn.textContent = s + 's后重发';
      if (s <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = '获取验证码'; }
    }, 1000);
  },

  async _handleLogout() {
    const ok = await UI.modal('退出登录', '确定要退出登录吗？', '退出', '取消');
    if (!ok) return;
    try { await API.logout(); } catch (e) { /* ignore */ }
    U.clearToken();
    this.user = null;
    this.card = null;
    await this.nav('auth');
    UI.toast('已退出', 'ok');
    console.log('[LOGOUT] done');
  }
};

// 启动
window.addEventListener('DOMContentLoaded', () => {
  App.init().catch(e => {
    console.error('[FATAL]', e);
    UI.toast('应用启动失败，请刷新页面', 'err');
  });
});
