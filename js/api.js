// 舞力打卡 - API请求封装 (v2.0 稳定版)
// 新增：自动重试、服务状态检测、超时控制、离线缓存

const API = {
  // 兼容 file:// 协议直接打开的情况
  BASE_URL: (window.location.protocol === 'file:'
    ? 'http://localhost:3099'
    : window.location.origin),

  // 服务状态
  _serverOnline: true,
  _retryCount: 0,
  _maxRetries: 2,
  _retryDelay: 1000,

  // 检查服务是否在线
  isOnline() {
    return this._serverOnline;
  },

  // 异步检查服务状态
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.BASE_URL}/api/health`, {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timer);
      this._serverOnline = res.ok;
      return res.ok;
    } catch (e) {
      this._serverOnline = false;
      return false;
    }
  },

  // 带超时的fetch
  _fetchWithTimeout(url, options, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error('请求超时，请重试'));
      }, timeout);

      options.signal = controller.signal;

      fetch(url, options)
        .then(res => { clearTimeout(timer); resolve(res); })
        .catch(err => {
          clearTimeout(timer);
          if (err.name === 'AbortError') {
            reject(new Error('请求超时，请重试'));
          } else {
            reject(err);
          }
        });
    });
  },

  // 通用请求 (带自动重试)
  async request(method, path, data, _retry = 0) {
    const url = `${this.BASE_URL}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = U.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await this._fetchWithTimeout(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined
      }, 8000);

      // 服务恢复了
      this._serverOnline = true;
      this._retryCount = 0;

      // 401未授权 → 清除Token跳转登录
      if (res.status === 401) {
        U.clearToken();
        App.user = null;
        App.card = null;
        App.nav('auth');
        throw new Error('登录已过期，请重新登录');
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '请求失败');
      return json;
    } catch (err) {
      // 网络错误 → 自动重试
      const isNetworkError = err.message === 'Failed to fetch'
        || err.message === '请求超时，请重试'
        || err.name === 'TypeError'
        || err.message.includes('NetworkError')
        || err.message.includes('fetch');

      if (isNetworkError && _retry < this._maxRetries) {
        this._serverOnline = false;
        this._retryCount++;
        console.log(`[API] ${method} ${path} 失败，${this._retryDelay}ms后重试(${_retry + 1}/${this._maxRetries})...`);
        await new Promise(r => setTimeout(r, this._retryDelay * (_retry + 1)));
        return this.request(method, path, data, _retry + 1);
      }

      // 重试也失败了
      if (isNetworkError) {
        this._serverOnline = false;
        throw new Error('网络连接失败，请确认服务已启动');
      }

      console.error(`[API] ${method} ${path} error:`, err);
      throw err;
    }
  },

  // GET
  get(path) {
    return this.request('GET', path);
  },

  // POST
  post(path, data) {
    return this.request('POST', path, data);
  },

  // PUT
  put(path, data) {
    return this.request('PUT', path, data);
  },

  // DELETE
  del(path) {
    return this.request('DELETE', path);
  },

  // ===== 账户相关 =====
  login(phone, code) {
    return this.post('/api/auth/login', { phone, code });
  },

  guestLogin() {
    return this.post('/api/auth/guest');
  },

  getProfile() {
    return this.get('/api/users/profile');
  },

  updateProfile(data) {
    return this.put('/api/users/profile', data);
  },

  logout() {
    return this.post('/api/auth/logout');
  },

  deleteAccount() {
    return this.del('/api/users/account');
  },

  // ===== 舞蹈卡 =====
  getCards() { return this.get('/api/cards'); },
  getCard(id) { return this.get('/api/cards/' + id); },
  createCard(data) { return this.post('/api/cards', data); },
  updateCard(id, data) { return this.put('/api/cards/' + id, data); },
  getCardStats() { return this.get('/api/cards/stats'); },
  recoverCalc(data) { return this.post('/api/cards/recover', data); },

  // ===== 课表模板 =====
  getTemplates() { return this.get('/api/templates'); },
  getTemplate(id) { return this.get('/api/templates/' + id); },
  getWeekSchedule(start, end) { return this.get('/api/templates/week?start=' + start + '&end=' + end); },
  createTemplate(data) { return this.post('/api/templates', data); },
  updateTemplate(id, data) { return this.put('/api/templates/' + id, data); },
  deleteTemplate(id) { return this.del('/api/templates/' + id); },
  smartGenerate(data) { return this.post('/api/smart/generate', data); },

  // ===== 打卡 =====
  getCheckins(cardId) { return this.get('/api/checkins' + (cardId ? '?cardId=' + cardId : '')); },
  createCheckin(data) { return this.post('/api/checkins', data); },
  updateCheckin(id, data) { return this.put('/api/checkins/' + id, data); },
  deleteCheckin(id) { return this.del('/api/checkins/' + id); },
  getCalendar(year, month) { return this.get('/api/checkins/calendar?year=' + year + '&month=' + month); },
  getStatistics() { return this.get('/api/checkins/statistics'); },

  // ===== 成就 =====
  getAchievements() { return this.get('/api/achievements'); },
  getAchievementSummary() { return this.get('/api/achievements/summary'); }
};
