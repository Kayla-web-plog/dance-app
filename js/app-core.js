// 舞力打卡 - 应用核心定义（Cloudflare API版本）
const App = {
  user: null,
  card: null,
  route: 'auth',
  hist: ['home'],

  // ---- 导航 ----
  async nav(route, params) {
    console.log(`[NAV] → ${route}`, params || '');

    // 登录检查
    const token = U.getToken();
    if (route !== 'auth' && !token) {
      console.log('[NAV] no token, redirect to auth');
      this._show('auth');
      return;
    }
    if (route === 'auth' && token) {
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
      profile: '我的', profileEdit: '编辑资料',
      reminders: '提醒设置'
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
      profile: 'profile', profileEdit: 'profile', reminders: 'profile',
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
        case 'checkinHistory': await this.loadHistory(params); break;
        case 'share': await this.loadShare(); break;
        case 'achievements': await this.loadAchievements(); break;
        case 'profile': await this.loadProfile(); break;
        case 'profileEdit': await this.loadProfileEdit(); break;
        case 'recover': await this.loadRecover(); break;
        case 'reminders': await this.loadReminders(); break;
        case 'auth': await this.loadAuth(); break;
        default: console.log('[NAV] no loader for route:', route);
      }
    } catch (e) {
      console.error(`[NAV] error loading ${route}:`, e);
      const container = document.getElementById(route + 'Content') || document.getElementById('pg-' + route);
      if (container) {
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
    } else {
      console.error('[SHOW] page element not found for route:', route);
    }
  },

  // ---- 初始化 ----
  async init() {
    console.log('=== 舞力打卡 v8.4 Cloudflare版 初始化 ===');

    // 检查是否有保存的token
    const token = U.getToken();
    if (token) {
      try {
        // 用token自动恢复登录
        const data = await API.getProfile();
        this.user = data.user;
        // 自动加载激活的舞蹈卡
        await this._loadActiveCard();
        console.log('[INIT] auto-login success:', this.user.nickname);
      } catch (e) {
        console.log('[INIT] auto-login failed:', e.message);
        U.clearToken();
        this.user = null;
        this.card = null;
      }
    }

    // 导航到对应页面
    await this.nav(this.user ? 'home' : 'auth');
    console.log('[INIT] ready, route:', this.route);
  },

  // 加载当前激活的舞蹈卡
  async _loadActiveCard() {
    try {
      const data = await API.getCardStats();
      if (data.stats && data.stats.hasCard) {
        const cardsData = await API.getCards();
        const active = (cardsData.cards || []).find(c => c.status === 'active');
        if (active) {
          this.card = active;
        }
      }
    } catch (e) {
      console.log('[CARD] load failed:', e.message);
    }
  }
};
