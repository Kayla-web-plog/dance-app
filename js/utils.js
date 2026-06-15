// 舞力打卡 - 工具函数
const U = {
  // 获取今日日期 YYYY-MM-DD
  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  // 格式化日期
  fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  },

  // 中文日期
  fmtCN(d) {
    const dt = new Date(d);
    const w = ['日','一','二','三','四','五','六'];
    return `${dt.getMonth()+1}月${dt.getDate()}日 周${w[dt.getDay()]}`;
  },

  // 金额格式
  money(n) {
    return (n || n === 0) ? `¥${Number(n).toFixed(2)}` : '—';
  },

  // 计算日期差
  days(a, b) {
    return Math.floor((new Date(a).getTime() - (b ? new Date(b).getTime() : Date.now())) / 86400000);
  },

  // 剩余天数
  remainDay(end) {
    return Math.max(0, this.days(end));
  },

  // 星期名
  dayName(n) {
    const m = ['日','一','二','三','四','五','六'];
    return m[n] || '';
  },

  // 本周一开始
  weekStart(d) {
    const dt = new Date(d || new Date());
    const day = dt.getDay();
    dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
    return this.fmtDate(dt);
  },

  // 本周日结束
  weekEnd(d) {
    const dt = new Date(this.weekStart(d));
    dt.setDate(dt.getDate() + 6);
    return this.fmtDate(dt);
  },

  // 月份天数数组(含占位)
  monthDays(y, m) {
    const days = [];
    const first = new Date(y, m, 1);
    const start = first.getDay() || 7;
    for (let i = 1; i < start; i++) days.push(null);
    for (let i = 1; i <= new Date(y, m, 0).getDate(); i++) {
      days.push(`${y}-${String(m).padStart(2,'0')}-${String(i).padStart(2,'0')}`);
    }
    return days;
  },

  // 存储Token
  setToken(token) {
    localStorage.setItem('dance_token', token);
  },

  // 获取Token
  getToken() {
    return localStorage.getItem('dance_token') || '';
  },

  // 清除Token
  clearToken() {
    localStorage.removeItem('dance_token');
  },

  // 获取星期几对应的中文
  weekdayCN(n) {
    return ['周日','周一','周二','周三','周四','周五','周六'][n] || '';
  }
};
