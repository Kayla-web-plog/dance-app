// 舞力打卡 - 本地存储API (v8.4 方案B：免费本地验证码)
// 模拟原有API接口，操作localStorage而不是发送HTTP请求

const API = {
  BASE_URL: '',

  // ---- 通用请求方法（模拟fetch）----
  async get(url) {
    return this._handleRequest('GET', url);
  },

  async post(url, data) {
    return this._handleRequest('POST', url, data);
  },

  async put(url, data) {
    return this._handleRequest('PUT', url, data);
  },

  async delete(url) {
    return this._handleRequest('DELETE', url);
  },

  // 处理请求（路由到本地存储操作）
  async _handleRequest(method, url, data) {
    console.log('[API-LOCAL]', method, url, data);

    // 解析URL路径
    const path = url.replace('/api', '');

    // 路由到对应的处理函数
    if (path === '/health') {
      return { ok: true };
    }

    if (path === '/auth/login' && method === 'POST') {
      return this._login(data.phone, data.code);
    }

    if (path === '/auth/register' && method === 'POST') {
      return this._register(data.phone);
    }

    if (path === '/auth/profile' && method === 'GET') {
      return this._getProfile();
    }

    if (path === '/auth/profile' && method === 'PUT') {
      return this._updateProfile(data);
    }

    if (path === '/auth/logout' && method === 'POST') {
      return this._logout();
    }

    if (path === '/auth/guest' && method === 'POST') {
      return this._guestLogin();
    }

    if (path === '/cards' && method === 'GET') {
      return this._getCards();
    }

    if (path.match(/^\/cards\/\d+$/) && method === 'GET') {
      const id = path.split('/')[2];
      return this._getCard(id);
    }

    if (path.match(/^\/cards\/\d+$/) && method === 'PUT') {
      const id = path.split('/')[2];
      return this._updateCard(id, data);
    }

    if (path.match(/^\/cards\/\d+$/) && method === 'DELETE') {
      const id = path.split('/')[2];
      return this._deleteCard(id);
    }

    if (path === '/cards' && method === 'POST') {
      return this._createCard(data);
    }

    if (path === '/cards/stats' && method === 'GET') {
      return this._getCardStats();
    }

    if (path === '/checkins' && method === 'GET') {
      return this._getCheckins();
    }

    if (path === '/checkins' && method === 'POST') {
      return this._createCheckin(data);
    }

    if (path.match(/^\/checkins\/\d+$/) && method === 'DELETE') {
      const id = path.split('/')[2];
      return this._deleteCheckin(id);
    }

    if (path === '/schedule' && method === 'GET') {
      return this._getSchedule();
    }

    if (path === '/schedule' && method === 'PUT') {
      return this._updateSchedule(data);
    }

    // 默认返回错误
    throw new Error('API路径不存在: ' + path);
  },

  // ---- 认证相关 ----
  async _login(phone, code) {
    const savedPhone = localStorage.getItem('dancePhone');
    const savedCode = localStorage.getItem('danceCode');

    if (phone === savedPhone && code === savedCode) {
      const token = 'local_' + Date.now();
      localStorage.setItem('danceToken', token);

      const userData = localStorage.getItem('danceUser_' + phone);
      const user = userData ? JSON.parse(userData) : null;

      return { token, user };
    } else {
      throw new Error('手机号或登录码错误');
    }
  },

  async _register(phone) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    localStorage.setItem('dancePhone', phone);
    localStorage.setItem('danceCode', code);

    const user = {
      phone,
      nickname: '舞者' + phone.slice(-4),
      avatar: '',
      danceTypes: [],
      danceLevel: 'beginner',
      freeTime: [],
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('danceUser_' + phone, JSON.stringify(user));

    const token = 'local_' + Date.now();
    localStorage.setItem('danceToken', token);

    return { token, user, code };
  },

  async _getProfile() {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const userData = localStorage.getItem('danceUser_' + phone);
    if (!userData) throw new Error('用户数据不存在');

    return { user: JSON.parse(userData) };
  },

  async _updateProfile(data) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const userData = localStorage.getItem('danceUser_' + phone);
    if (!userData) throw new Error('用户数据不存在');

    const user = JSON.parse(userData);
    Object.assign(user, data);
    localStorage.setItem('danceUser_' + phone, JSON.stringify(user));

    return { user };
  },

  async _logout() {
    localStorage.removeItem('danceToken');
    return { ok: true };
  },

  async _guestLogin() {
    const guestId = 'guest_' + Date.now();
    const token = 'local_' + guestId;
    localStorage.setItem('danceToken', token);

    const user = {
      id: guestId,
      nickname: '游客',
      avatar: '',
      isGuest: true
    };
    localStorage.setItem('danceUser_guest', JSON.stringify(user));

    return { token, user };
  },

  // ---- 舞蹈卡相关 ----
  async _getCards() {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const cardsData = localStorage.getItem('danceCards_' + phone);
    const cards = cardsData ? JSON.parse(cardsData) : [];

    return { cards };
  },

  async _getCard(id) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const cardsData = localStorage.getItem('danceCards_' + phone);
    const cards = cardsData ? JSON.parse(cardsData) : [];

    const card = cards.find(c => c.id === id);
    if (!card) throw new Error('舞蹈卡不存在');

    return { card };
  },

  async _createCard(data) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const cardsData = localStorage.getItem('danceCards_' + phone);
    let cards = cardsData ? JSON.parse(cardsData) : [];

    const newCard = {
      id: 'card_' + Date.now(),
      ...data,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    cards = cards.map(c => ({ ...c, status: 'inactive' }));
    cards.push(newCard);

    localStorage.setItem('danceCards_' + phone, JSON.stringify(cards));

    return { card: newCard };
  },

  async _updateCard(id, data) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const cardsData = localStorage.getItem('danceCards_' + phone);
    let cards = cardsData ? JSON.parse(cardsData) : [];

    cards = cards.map(c => c.id === id ? { ...c, ...data } : c);

    localStorage.setItem('danceCards_' + phone, JSON.stringify(cards));

    return { ok: true };
  },

  async _deleteCard(id) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const cardsData = localStorage.getItem('danceCards_' + phone);
    let cards = cardsData ? JSON.parse(cardsData) : [];

    cards = cards.filter(c => c.id !== id);

    localStorage.setItem('danceCards_' + phone, JSON.stringify(cards));

    return { ok: true };
  },

  async _getCardStats() {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const cardsData = localStorage.getItem('danceCards_' + phone);
    const cards = cardsData ? JSON.parse(cardsData) : [];

    const activeCard = cards.find(c => c.status === 'active');

    if (!activeCard) {
      return { stats: { hasCard: false } };
    }

    const checkinsData = localStorage.getItem('danceCheckins_' + phone);
    const checkins = checkinsData ? JSON.parse(checkinsData) : [];
    const cardCheckins = checkins.filter(c => c.cardId === activeCard.id);

    const totalUsed = cardCheckins.reduce((sum, c) => sum + c.price, 0);
    const totalClasses = cardCheckins.length;
    const actualPrice = totalClasses > 0 ? totalUsed / totalClasses : 0;

    return {
      stats: {
        hasCard: true,
        cardId: activeCard.id,
        cardName: activeCard.name,
        totalPrice: activeCard.totalPrice,
        totalClasses: activeCard.totalClasses,
        usedClasses: totalClasses,
        remainingClasses: activeCard.totalClasses - totalClasses,
        totalUsed,
        actualPrice,
        targetPrice: activeCard.targetPrice
      }
    };
  },

  // ---- 打卡相关 ----
  async _getCheckins() {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const checkinsData = localStorage.getItem('danceCheckins_' + phone);
    let checkins = checkinsData ? JSON.parse(checkinsData) : [];

    checkins.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { checkins };
  },

  async _createCheckin(data) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const checkinsData = localStorage.getItem('danceCheckins_' + phone);
    let checkins = checkinsData ? JSON.parse(checkinsData) : [];

    const newCheckin = {
      id: 'checkin_' + Date.now(),
      ...data,
      createdAt: new Date().toISOString()
    };

    checkins.push(newCheckin);

    localStorage.setItem('danceCheckins_' + phone, JSON.stringify(checkins));

    return { checkin: newCheckin };
  },

  async _deleteCheckin(id) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const checkinsData = localStorage.getItem('danceCheckins_' + phone);
    let checkins = checkinsData ? JSON.parse(checkinsData) : [];

    checkins = checkins.filter(c => c.id !== id);

    localStorage.setItem('danceCheckins_' + phone, JSON.stringify(checkins));

    return { ok: true };
  },

  // ---- 课表相关 ----
  async _getSchedule() {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    const scheduleData = localStorage.getItem('danceSchedule_' + phone);
    const schedule = scheduleData ? JSON.parse(scheduleData) : [];

    return { schedule };
  },

  async _updateSchedule(data) {
    const phone = localStorage.getItem('dancePhone');
    if (!phone) throw new Error('未登录');

    localStorage.setItem('danceSchedule_' + phone, JSON.stringify(data));

    return { ok: true };
  },

  // ---- 其他工具方法 ----
  checkHealth() {
    return Promise.resolve(true);
  },

  isOnline() {
    return true;
  },

  setToken(token) {
    localStorage.setItem('danceToken', token);
  },

  getToken() {
    return localStorage.getItem('danceToken');
  },

  clearToken() {
    localStorage.removeItem('danceToken');
  }
};
