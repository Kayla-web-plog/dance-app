// 舞力打卡 - 课表管理 v7.0
// 双Tab: 舞蹈室课表(只读+导入) | 个人课表(表格+编辑打卡+空闲时间)

App._schedTab = 'studio'; // 'studio' | 'personal'
App._schedWeekIdx = 0;
App._schedYear = new Date().getFullYear();
App._schedMonth = new Date().getMonth() + 1;
App._availTime = null; // 用户空闲时间数据

// ===== 精致配色系统 v7.0 =====
// 告别emoji圆点，用渐变色条+柔和底色
const DANCE_STYLES = {
  'Jazz':        { gradient:'linear-gradient(135deg,#f472b6,#ec4899)', light:'#fdf2f8', tag:'#db2777', icon:'💃' },
  '韩舞女团':    { gradient:'linear-gradient(135deg,#a78bfa,#8b5cf6)', light:'#f5f3ff', tag:'#7c3aed', icon:'✨' },
  'K-pop':       { gradient:'linear-gradient(135deg,#a78bfa,#8b5cf6)', light:'#f5f3ff', tag:'#7c3aed', icon:'✨' },
  'Hiphop':      { gradient:'linear-gradient(135deg,#60a5fa,#3b82f6)', light:'#eff6ff', tag:'#2563eb', icon:'🎤' },
  '街舞HIPHOP':  { gradient:'linear-gradient(135deg,#60a5fa,#3b82f6)', light:'#eff6ff', tag:'#2563eb', icon:'🎤' },
  '钢管':        { gradient:'linear-gradient(135deg,#c084fc,#a855f7)', light:'#faf5ff', tag:'#9333ea', icon:'🪄' },
  '软开':        { gradient:'linear-gradient(135deg,#2dd4bf,#14b8a6)', light:'#f0fdfa', tag:'#0d9488', icon:'🧘' },
  '舞蹈通识':    { gradient:'linear-gradient(135deg,#34d399,#10b981)', light:'#ecfdf5', tag:'#059669', icon:'🎯' },
  '私教':        { gradient:'linear-gradient(135deg,#fb923c,#f97316)', light:'#fff7ed', tag:'#ea580c', icon:'👑' },
  '抖音舞':      { gradient:'linear-gradient(135deg,#fbbf24,#f59e0b)', light:'#fffbeb', tag:'#d97706', icon:'🎵' },
  '拍摄':        { gradient:'linear-gradient(135deg,#94a3b8,#64748b)', light:'#f8fafc', tag:'#475569', icon:'📷' },
  'default':     { gradient:'linear-gradient(135deg,#a78bfa,#7c5cfc)', light:'#f5f3ff', tag:'#6d28d9', icon:'💫' }
};

function ds(type) { return DANCE_STYLES[type] || DANCE_STYLES['default']; }

App.loadSchedule = async function() {
  const container = document.getElementById('scheduleContent');
  if (!container) return;
  container.innerHTML = `<div class="sk-c" style="width:36px;height:36px;margin:80px auto"></div>`;
  this._schedTab = this._schedTab || 'studio';
  await this._renderSchedule(container);
};

App._renderSchedule = async function(ct) {
  try {
    const templates = await API.get('/api/templates');
    const allCourses = templates.templates || [];

    // ===== Tab Bar (精致胶囊式) =====
    let html = `<div class="sched-tabs">
      <div class="sched-tab ${this._schedTab==='studio'?'on':''}" onclick="App._switchTab('studio')">
        <svg width="16" height="16" style="vertical-align:-2px;margin-right:4px"><use href="#i-cal"/></svg>舞蹈室课表
      </div>
      <div class="sched-tab ${this._schedTab==='personal'?'on':''}" onclick="App._switchTab('personal')">
        <svg width="16" height="16" style="vertical-align:-2px;margin-right:4px"><use href="#i-user"/></svg>个人课表
      </div>
    </div>`;

    if (this._schedTab === 'studio') {
      html += this._renderStudio(allCourses);
    } else {
      html += await this._renderPersonal(allCourses);
    }

    ct.innerHTML = html;

    // 渲染后初始化空闲时间
    if (this._schedTab === 'personal') {
      this._initAvailTime();
    }
  } catch(e) {
    ct.innerHTML = `<div class="sched-empty"><div class="sched-empty-icon">😵</div><div>${e.message}</div></div>`;
  }
};

App._switchTab = function(tab) {
  this._schedTab = tab;
  this.loadSchedule();
};

// ===== 舞蹈室课表 (只读 + 导入) =====
App._renderStudio = function(courses) {
  if (courses.length === 0) {
    return `<div class="sched-empty">
      <div class="sched-empty-icon">🏫</div>
      <div class="sched-empty-title">还没有舞蹈室课表</div>
      <div class="sched-empty-desc">导入你的舞蹈室课表截图，自动识别所有课程</div>
      <button class="btn btn-p" onclick="App._showImport()" style="margin-top:16px">📸 导入课表截图</button>
    </div>`;
  }

  const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
  const timeSlots = [...new Set(courses.map(c=>c.time).filter(Boolean))].sort((a,b)=>parseInt(a.split(':')[0])-parseInt(b.split(':')[0]));

  // 按星期+时间组织
  const grid = {};
  for (let w=0; w<7; w++) grid[w] = {};
  timeSlots.forEach(ts => { for (let w=0; w<7; w++) grid[w][ts] = []; });
  courses.forEach(c => { if(grid[c.weekday] && grid[c.weekday][c.time]) grid[c.weekday][c.time].push(c); });

  const today = new Date();
  const todayWD = today.getDay();
  const todayStr = U.today();

  // ===== Header =====
  let html = `<div class="st-header">
    <div class="st-header-left">
      <div class="st-title">舞蹈室完整课表</div>
      <div class="st-sub">${dayNames[todayWD]} · ${todayStr.slice(5)}</div>
    </div>
    <button class="st-update-btn" onclick="App._showImport()">
      <svg width="14" height="14"><use href="#i-edit"/></svg> 更新
    </button>
  </div>`;

  // ===== Grid =====
  html += `<div class="st-grid-wrap"><div class="st-grid">`;

  // 表头行
  html += `<div class="st-corner">时间</div>`;
  dayNames.forEach((dn, i) => {
    const isToday = i === todayWD;
    html += `<div class="st-day-hdr ${isToday?'st-day-today':''}">
      <span class="st-day-name">${dn}</span>
      ${isToday?`<span class="st-today-badge">今天</span>`:''}
    </div>`;
  });

  // 数据行
  timeSlots.forEach(ts => {
    html += `<div class="st-time">${formatTimeSlot(ts)}</div>`;
    for (let w = 0; w < 7; w++) {
      const cs = grid[w][ts] || [];
      const isToday = w === todayWD;
      if (w === 1) {
        // 周一公休 - CSS Grid span跨行
        if (ts === timeSlots[0]) {
          html += `<div class="st-cell st-rest-cell ${isToday?'st-cell-today':''}" style="grid-row:span ${timeSlots.length}">
            <div class="st-rest-inner">
              <div class="st-rest-icon">🏖️</div>
              <div class="st-rest-text">公休日</div>
            </div>
          </div>`;
        }
        // 后续时间行跳过周一列(已被span占据)
      } else if (cs.length > 0) {
        html += `<div class="st-cell st-has-course ${isToday?'st-cell-today':''}">`;
        cs.forEach(c => {
          const s = ds(c.danceType);
          html += `<div class="st-course" style="--course-gradient:${s.gradient};--course-light:${s.light};--course-tag:${s.tag}" onclick="App._viewStudioCourse('${c.courseName}')">
            <div class="st-course-bar"></div>
            <div class="st-course-body">
              <div class="st-course-name">${c.courseName}</div>
              <div class="st-course-meta">
                <span class="st-course-type">${s.icon} ${c.danceType||'舞蹈'}</span>
                ${c.level?`<span class="st-course-level">${c.level}</span>`:''}
              </div>
            </div>
          </div>`;
        });
        html += `</div>`;
      } else {
        html += `<div class="st-cell st-empty ${isToday?'st-cell-today':''}"></div>`;
      }
    }
  });

  html += `</div></div>`;

  // ===== 底部舞种图例 =====
  html += `<div class="st-legend">
    ${Object.entries(DANCE_STYLES).filter(([k])=>k!=='default'&&k!=='K-pop'&&k!=='街舞HIPHOP').slice(0,8).map(([k,v])=>
      `<span class="st-legend-item"><span class="st-legend-dot" style="background:${v.gradient}"></span>${k}</span>`
    ).join('')}
  </div>`;

  return html;
};

function formatTimeSlot(ts) {
  const p = (ts||'').split('-');
  if (p.length===2) return `<span class="ts-s">${p[0]}</span><span class="ts-d">-</span><span class="ts-e">${p[1]}</span>`;
  return ts;
}

App._viewStudioCourse = function(name) {
  UI.toast(name, 'ok');
};

// ===== 个人课表 =====
App._renderPersonal = async function(courses) {
  const y = this._schedYear, m = this._schedMonth;
  const monthFirstDay = new Date(y, m-1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const totalWeeks = Math.ceil((monthFirstDay.getDay() + daysInMonth) / 7);

  if (this._schedWeekIdx<0) this._schedWeekIdx=0;
  if (this._schedWeekIdx>=totalWeeks) this._schedWeekIdx=totalWeeks-1;

  const weekStartDay = 1 + this._schedWeekIdx*7 - monthFirstDay.getDay();
  const startStr = `${y}-${String(m).padStart(2,'0')}-${String(Math.max(1,weekStartDay)).padStart(2,'0')}`;
  const endStr = `${y}-${String(m).padStart(2,'0')}-${String(Math.min(weekStartDay+6,daysInMonth)).padStart(2,'0')}`;

  // 周日期数组
  const weekDates = [];
  const dayLabels = ['日','一','二','三','四','五','六'];
  const todayStr = U.today();

  let weekStart = Math.max(1, weekStartDay);
  const firstDayOfWeek = monthFirstDay.getDay();
  for (let i = 0; i < 7; i++) {
    const dayOfMonth = weekStart + (i - firstDayOfWeek);
    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
      weekDates.push(null);
    } else {
      const d = new Date(y, m-1, dayOfMonth);
      weekDates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
  }

  // 获取用户打卡记录 (近30天)
  let checkins = [];
  try { const cd = await API.get('/api/checkins?limit=200'); checkins = cd.checkins||[]; } catch(e){}

  // 打卡状态映射
  const ckMap = {};
  checkins.forEach(ck => { ckMap[ck.courseDate+'|'+ck.courseName] = ck; });

  // 个人课表（从localStorage读取）- 个人课表只展示用户选择的课程
  const personalSched = JSON.parse(localStorage.getItem('dance_personal_schedule') || '[]');

  // 按日期+时间组织个人课程
  const dayMap = {};
  const personalKeys = new Set();
  personalSched.forEach(c => {
    const date = weekDates[c.weekday];
    if (!date) return;
    const key = `${c.weekday}|${c.time}|${c.courseName}`;
    if (personalKeys.has(key)) return; // 个人课表内部去重
    personalKeys.add(key);
    if (!dayMap[date]) dayMap[date] = [];
    dayMap[date].push({
      id: c.id || 'personal_'+Date.now()+'_'+c.weekday+'_'+c.time,
      courseName: c.courseName,
      time: c.time,
      weekday: c.weekday,
      danceType: c.danceType,
      level: c.level,
      teacher: c.teacher || '',
      isPersonal: true
    });
  });

  // 获取所有时间槽（从全部模板，用于构建表格结构）
  const timeSlots = [...new Set(courses.map(c=>c.time).filter(Boolean))].sort((a,b)=>parseInt(a.split(':')[0])-parseInt(b.split(':')[0]));

  // ===== 空闲时间入口 =====
  let html = `<div class="ps-avail-entrance" onclick="App._toggleAvailPanel()">
    <div class="ps-avail-entrance-left">
      <span class="ps-avail-icon">🕐</span>
      <span>我的空闲时间</span>
    </div>
    <svg width="16" height="16" style="color:var(--t3)" id="availArrow"><use href="#i-back"/></svg>
  </div>`;

  // ===== 空闲时间面板 (默认隐藏) =====
  html += `<div class="ps-avail-panel" id="availPanel" style="display:none">
    <div class="ps-avail-header">
      <span class="ps-avail-title">设置空闲时段</span>
      <button class="btn btn-p btn-sm" onclick="App._saveAvailTime()">保存</button>
    </div>
    <div class="ps-avail-desc">选择你可以上课的时间段，App会为你智能排课</div>
    <div class="ps-avail-grid" id="availGrid"></div>
    <div class="ps-avail-actions">
      <button class="btn btn-o btn-sm" onclick="App._autoSchedule()" style="flex:1">
        <svg width="14" height="14"><use href="#i-magic"/></svg> 智能排课
      </button>
      <button class="btn btn-ghost btn-sm" onclick="App._clearAvailTime()" style="flex:1">清空选择</button>
    </div>
  </div>`;

  // ===== 月导航 =====
  html += `<div class="ps-nav">
    <button class="ps-nav-btn" onclick="App._prevMonth()">‹</button>
    <span class="ps-nav-title">${y}年${m}月</span>
    <button class="ps-nav-btn" onclick="App._nextMonth()">›</button>
  </div>`;

  // 周标签
  const monthFirstDow = monthFirstDay.getDay();
  html += `<div class="ps-week-tabs">`;
  for (let w=0; w<totalWeeks; w++) {
    let ws = 1 + w*7 - monthFirstDow;
    let we = ws + 6;
    ws = Math.max(1, Math.min(ws, daysInMonth));
    we = Math.max(1, Math.min(we, daysInMonth));
    html += `<span class="ps-week-tab ${w===this._schedWeekIdx?'on':''}" onclick="App._gotoWeek(${w})">W${w+1} <small>${ws}-${we}</small></span>`;
  }
  html += `</div>`;

  // ===== 课表表格 - 时间列固定，横向滚动星期 =====
  html += `<div class="ps-table-wrap"><div class="ps-table-scroll">
    <table class="ps-table">
      <thead><tr><th class="ps-th ps-th-time">时间</th>`;
  dayLabels.forEach((wd, i) => {
    const d = weekDates[i], isToday = d===todayStr;
    const display = d ? d.slice(5) : '—';
    html += `<th class="ps-th ps-th-day ${isToday?'ps-th-today':''}">
      <span class="ps-day-name">周${wd}</span><span class="ps-day-date">${display}</span></th>`;
  });
  html += `</tr></thead><tbody>`;

  timeSlots.forEach(ts => {
    html += `<tr><td class="ps-td-time">${formatTimeSlot(ts)}</td>`;
    weekDates.forEach((date, idx) => {
      const isToday = date===todayStr;
      if (!date) {
        html += `<td class="ps-td-cell ps-td-empty" style="background:#fafafa;cursor:default"></td>`;
        return;
      }
      const cs = (dayMap[date]||[]).filter(c => c.time===ts);
      if (idx===1 && ts===timeSlots[0]) {
        html += `<td class="ps-td-cell ${isToday?'ps-td-today':''}"><div class="ps-rest">🏖️ 公休</div></td>`;
      } else if (cs.length>0) {
        html += `<td class="ps-td-cell ${isToday?'ps-td-today':''}">`;
        cs.forEach(c => {
          const ck = ckMap[date+'|'+c.courseName];
          const s = ds(c.danceType);
          const statusCls = ck ? (ck.status==='done'?'ps-card-done':'ps-card-absent') : '';
          const statusIcon = ck ? (ck.status==='done'? '✅' : '❌') : '';
          const shortName = c.courseName.length>10 ? c.courseName.slice(0,10)+'…' : c.courseName;
          html += `<div class="ps-card ${statusCls}" style="--course-gradient:${s.gradient};--course-light:${s.light};--course-tag:${s.tag}" onclick="App._editTemplate(${c.id})">
            <div class="ps-card-bar"></div>
            <div class="ps-card-body">
              <div class="ps-card-top">
                <span class="ps-card-icon">${s.icon}</span>
                ${statusIcon?`<span class="ps-card-status">${statusIcon}</span>`:''}
              </div>
              <div class="ps-card-name">${shortName}</div>
              <div class="ps-card-meta">
                <span class="ps-card-type">${c.danceType||'舞蹈'}</span>
                ${c.level?`<span class="ps-card-level">${c.level}</span>`:''}
              </div>
              ${ck && ck.stars?`<div class="ps-card-stars">${'★'.repeat(ck.stars)}</div>`:''}
            </div>
          </div>`;
        });
        html += `</td>`;
      } else {
        html += `<td class="ps-td-cell ps-td-empty ${isToday?'ps-td-today':''}">
          <div class="ps-add-btn" onclick="App._quickAdd('${date}','${ts}')">+</div>
        </td>`;
      }
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div></div>`;

  // 一键清空个人课表
  const personalCount = personalSched.length;
  if (personalCount > 0) {
    html += `<button class="ps-add-course-btn" style="background:transparent;color:var(--t3);border-color:transparent;font-size:12px" onclick="App._clearPersonalSchedule()">
      <svg width="14" height="14"><use href="#i-trash"/></svg> 清空个人课表 (${personalCount}节)
    </button>`;
  }

  // 添加课程按钮
  html += `<button class="ps-add-course-btn" onclick="App._showAddCourseModal()">
    <svg width="16" height="16"><use href="#i-plus"/></svg> 添加课程到个人课表
  </button>`;

  return html;
};

// ===== 空闲时间管理 =====
App._toggleAvailPanel = function() {
  const panel = document.getElementById('availPanel');
  const arrow = document.getElementById('availArrow');
  if (!panel) return;
  const isVisible = panel.style.display !== 'none';
  panel.style.display = isVisible ? 'none' : 'block';
  if (arrow) arrow.style.transform = isVisible ? '' : 'rotate(90deg)';
  if (!isVisible) this._renderAvailGrid();
};

App._renderAvailGrid = function() {
  const grid = document.getElementById('availGrid');
  if (!grid) return;

  // 加载已有数据
  if (!this._availTime) {
    try { this._availTime = JSON.parse(localStorage.getItem('dance_avail_time') || '{}'); } catch(e) { this._availTime = {}; }
  }

  const days = ['周一','周二','周三','周四','周五','周六','周日'];
  const periods = ['上午','下午','晚上'];
  const dayIdx = [1,2,3,4,5,6,0]; // 映射到weekday

  let html = `<div class="ps-avail-row ps-avail-hdr"><div class="ps-avail-dh"></div>`;
  periods.forEach(p => { html += `<div class="ps-avail-ph">${p}</div>`; });
  html += `</div>`;

  days.forEach((day, di) => {
    const wd = dayIdx[di];
    html += `<div class="ps-avail-row"><div class="ps-avail-dh">${day}</div>`;
    periods.forEach((period, pi) => {
      const key = `${wd}_${pi}`;
      const checked = this._availTime[key];
      html += `<div class="ps-avail-cell ${checked?'on':''}" data-key="${key}" onclick="App._toggleAvailCell(this)">
        ${checked?'✓':''}
      </div>`;
    });
    html += `</div>`;
  });

  grid.innerHTML = html;
};

App._toggleAvailCell = function(el) {
  const key = el.dataset.key;
  const wasOn = el.classList.contains('on');
  el.classList.toggle('on');
  el.textContent = wasOn ? '' : '✓';
  if (!this._availTime) this._availTime = {};
  if (wasOn) { delete this._availTime[key]; }
  else { this._availTime[key] = true; }
};

App._saveAvailTime = function() {
  try {
    localStorage.setItem('dance_avail_time', JSON.stringify(this._availTime || {}));
    UI.toast('空闲时间已保存', 'ok');
  } catch(e) { UI.toast('保存失败', 'err'); }
};

App._clearAvailTime = function() {
  this._availTime = {};
  localStorage.removeItem('dance_avail_time');
  this._renderAvailGrid();
  UI.toast('已清空', 'ok');
};

App._initAvailTime = function() {
  // 如果面板可见则渲染
  const panel = document.getElementById('availPanel');
  if (panel && panel.style.display !== 'none') {
    this._renderAvailGrid();
  }
};

// ===== 智能排课 v8.2 (使用用户的意愿舞种+空闲时间，放宽水平限制) =====
App._autoSchedule = async function() {
  if (!this._availTime || Object.keys(this._availTime).length === 0) {
    UI.toast('请先设置空闲时间', 'err');
    return;
  }

  // 优先使用用户资料中的"常用舞种"（意愿课程）
  const userU = this.user || {};
  const prefTypes = (userU.danceTypes && userU.danceTypes.length > 0)
    ? userU.danceTypes
    : ['Jazz', 'K-pop', 'Hiphop', '舞蹈通识'];
  // 水平映射
  const levelMap = { beginner:'入门', elementary:'入门', intermediate:'中阶', advanced:'高阶', professional:'高阶' };
  const userLevel = levelMap[userU.danceLevel] || '中阶';
  const levelRank = { '入门': 1, '中阶': 2, '高阶': 3 };
  const userLevelRank = levelRank[userLevel] || 2;

  try {
    const templates = await API.get('/api/templates');
    const allCourses = templates.templates || [];

    // 解析空闲时间 → weekday → periods
    const availMap = {};
    Object.keys(this._availTime).forEach(key => {
      const [wd, pi] = key.split('_').map(Number);
      if (!availMap[wd]) availMap[wd] = [];
      availMap[wd].push(pi);
    });

    // 匹配课程：空闲时间匹配 + 偏好优先排序
    const matched = [];
    allCourses.forEach(c => {
      if (!availMap[c.weekday]) return;
      const hour = parseInt((c.time||'').split(':')[0]) || 0;
      let period = hour < 12 ? 0 : (hour < 17 ? 1 : 2);
      if (!availMap[c.weekday].includes(period)) return;

      // 计算优先级分数（越高越推荐）
      let score = 0;
      // 偏好舞种 +50
      if (prefTypes.includes(c.danceType)) score += 50;
      // 水平匹配 +30，接近的+20，高阶的+10（用户中阶可以上中阶和高阶）
      const cl = levelRank[c.level] || 1;
      if (cl <= userLevelRank) score += 30;
      else if (cl === userLevelRank + 1) score += 10;
      // 入门课程所有人适合 +5
      if (cl === 1) score += 5;

      matched.push({ ...c, score });
    });

    // 按分数降序，同分数按weekday排序
    matched.sort((a, b) => b.score - a.score || a.weekday - b.weekday);

    if (matched.length === 0) {
      UI.toast('没有匹配的课程（请检查空闲时间设置）', 'err');
      return;
    }

    const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];

    // 读取已有个人课表用于去重
    let existingPersonal = [];
    try { existingPersonal = JSON.parse(localStorage.getItem('dance_personal_schedule') || '[]'); } catch(e){}
    const existingKeys = new Set(existingPersonal.map(p => `${p.weekday}|${p.time}|${p.courseName}`));

    // 显示可选择的推荐结果
    const modal = document.createElement('div');
    modal.className = 'mdl';
    modal.id = 'autoSchedModal';

    const prefCount = matched.filter(c => prefTypes.includes(c.danceType)).length;

    let html = `<div class="mdl-box" style="width:min(420px,94vw);padding:24px 20px;max-height:85vh;overflow-y:auto">
      <div style="font-size:18px;font-weight:800;color:var(--t1);margin-bottom:4px">🎯 智能推荐</div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:14px">
        偏好舞种: ${prefTypes.join('、')} · 你的水平: ${userLevel} · 匹配${matched.length}节 · 偏好${prefCount}节
      </div>`;

    matched.forEach((c, idx) => {
      const s = ds(c.danceType);
      const cl = levelRank[c.level] || 1;
      const isPref = prefTypes.includes(c.danceType);
      const isBlocked = cl > userLevelRank + 1; // 高两阶以上标记为挑战
      const isAdded = existingKeys.has(`${c.weekday}|${c.time}|${c.courseName}`);

      html += `<div class="sc-rec-item ${isAdded?'added':''}" id="sc-rec-${idx}" style="border-left:3px solid ${s.tag};${isAdded?'opacity:.5':''}" onclick="${isAdded?'':'App._toggleRecSelect('+idx+')'}">
        <div class="sc-rec-body">
          <div class="sc-rec-name">${c.courseName}</div>
          <div class="sc-rec-meta">
            <span>${dayNames[c.weekday]} ${c.time||''}</span>
            <span style="color:${s.tag};font-weight:600">${s.icon} ${c.danceType||'舞蹈'}</span>
            <span class="sc-rec-level ${cl<=userLevelRank?'sc-rec-ok':(isBlocked?'sc-rec-blocked':'sc-rec-warn')}">${c.level||'不限'}</span>
            ${isPref?`<span class="sc-rec-pref">偏好</span>`:''}
            ${isAdded?`<span class="sc-rec-added">已添加</span>`:''}
          </div>
        </div>
        <div class="sc-rec-check" id="sc-rec-check-${idx}">
          ${isAdded?'<span style="font-size:12px;color:var(--green)">✓</span>':'<svg width="20" height="20"><use href="#i-plus"/></svg>'}
        </div>
      </div>`;
    });

    html += `<div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-ghost btn-b" style="flex:1" onclick="document.getElementById('autoSchedModal').remove()">取消</button>
      <button class="btn btn-p btn-b" style="flex:1" id="sc-confirm-btn" disabled
        onclick="App._confirmRecSchedule()">确认添加 (0节)</button>
    </div></div>`;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // 存储匹配数据供选择使用
    this._recCourses = matched;
    this._recSelected = {};

    // CSS for the recommendation UI
    if (!document.getElementById('sc-rec-css')) {
      const style = document.createElement('style');
      style.id = 'sc-rec-css';
      style.textContent = `
.sc-rec-item{display:flex;align-items:center;gap:10px;padding:12px;margin:6px 0;
  border-radius:var(--r);background:var(--bg2);border:1px solid var(--bd-light);
  cursor:pointer;transition:all .2s;}
.sc-rec-item:hover{background:var(--clr-ghost);}
.sc-rec-item.added{cursor:default;}
.sc-rec-body{flex:1;min-width:0;}
.sc-rec-name{font-weight:700;font-size:14px;color:var(--t1);margin-bottom:3px;}
.sc-rec-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--t3);align-items:center;}
.sc-rec-level{padding:1px 6px;border-radius:4px;font-size:10px;}
.sc-rec-ok{background:var(--green-ghost);color:var(--green);}
.sc-rec-warn{background:var(--orange-ghost);color:var(--orange);}
.sc-rec-blocked{background:var(--red-ghost);color:var(--red);}
.sc-rec-pref{padding:1px 6px;border-radius:4px;background:var(--clr-ghost);color:var(--clr);font-size:10px;}
.sc-rec-added{padding:1px 6px;border-radius:4px;background:var(--green-ghost);color:var(--green);font-size:10px;}
.sc-rec-check{width:28px;height:28px;border-radius:50%;border:2px solid var(--bd);
  display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;}
.sc-rec-item.sel .sc-rec-check{background:var(--clr);border-color:var(--clr);color:#fff;}
.sc-rec-item.sel{background:var(--clr-ghost);border-color:var(--clr-lighter);}`;
      document.head.appendChild(style);
    }

  } catch(e) {
    UI.toast('排课失败: ' + e.message, 'err');
  }
};

// ===== 选择/取消推荐课程 =====
App._toggleRecSelect = function(idx) {
  const item = document.getElementById(`sc-rec-${idx}`);
  if (!item) return;
  const isSelected = item.classList.toggle('sel');
  if (isSelected) {
    this._recSelected[idx] = true;
  } else {
    delete this._recSelected[idx];
  }
  // 更新确认按钮
  const count = Object.keys(this._recSelected).length;
  const btn = document.getElementById('sc-confirm-btn');
  if (btn) {
    btn.disabled = count === 0;
    btn.textContent = `确认添加 (${count}节)`;
  }
};

// ===== 确认添加课程到个人课表 =====
App._confirmRecSchedule = function() {
  const selected = [];
  Object.keys(this._recSelected).forEach(idx => {
    const c = this._recCourses[parseInt(idx)];
    if (c) selected.push(c);
  });
  if (selected.length === 0) {
    UI.toast('请先选择课程', 'err');
    return;
  }

  // 读取已有个人课表
  let personalSched = JSON.parse(localStorage.getItem('dance_personal_schedule') || '[]');

  // 添加选中课程
  selected.forEach(c => {
    // 去重检查
    const exists = personalSched.some(p => p.courseName === c.courseName && p.weekday === c.weekday && p.time === c.time);
    if (!exists) {
      personalSched.push({
        id: Date.now() + Math.random() * 1000,
        courseName: c.courseName,
        time: c.time,
        weekday: c.weekday,
        danceType: c.danceType,
        level: c.level,
        addedAt: U.today()
      });
    }
  });

  localStorage.setItem('dance_personal_schedule', JSON.stringify(personalSched));
  document.getElementById('autoSchedModal').remove();
  UI.toast(`已添加 ${selected.length} 节课到个人课表`, 'ok');
  this.loadSchedule(); // 刷新
};

// ===== 导入弹窗 =====
App._showImport = function() {
  const modal = document.createElement('div'); modal.className = 'mdl'; modal.id = 'importModal';
  modal.innerHTML = `<div class="mdl-box" style="width:min(380px,90vw);padding:24px;text-align:center">
    <div class="mdl-t">📸 导入舞蹈室课表</div>
    <div style="font-size:13px;color:var(--t3);margin:12px 0 20px;line-height:1.6">
      支持截图识别表格中的课程数据<br>
      <span style="font-size:11px;color:var(--t4)">支持常见课表截图格式</span>
    </div>
    <div class="import-zone" id="importZone" onclick="document.getElementById('importFile').click()">
      <div class="import-zone-icon">📋</div>
      <div class="import-zone-text">点击上传课表截图</div>
      <div class="import-zone-hint">或拖拽图片到此处 | PNG / JPG</div>
      <input type="file" id="importFile" accept="image/*" style="display:none" onchange="App._handleImport(event)">
    </div>
    <div class="import-manual" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--bd-light)">
      <div style="font-size:12px;color:var(--t3);margin-bottom:8px">或手动输入课表数据</div>
      <textarea class="inp" id="importText" rows="5" placeholder="每行一个课程:&#10;周二 14:00-15:10 舞蹈通识C(入门)&#10;周三 19:00-20:10 爵士舞A1-1(中阶)"></textarea>
      <button class="btn btn-o btn-b" style="margin-top:8px" onclick="App._manualImport()">手动导入</button>
    </div>
    <button class="btn btn-ghost btn-b" style="margin-top:8px" onclick="document.getElementById('importModal').remove()">关闭</button></div>`;
  document.body.appendChild(modal);
};

App._handleImport = function(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  if (file.size > 10*1024*1024) { UI.toast('图片不能超过10MB', 'err'); return; }
  UI.toast('OCR识别暂时使用手动模式，请粘贴课表文字数据', 'ok');
};

App._manualImport = async function() {
  const text = document.getElementById('importText').value.trim();
  if (!text) { UI.toast('请输入课表数据', 'err'); return; }
  const lines = text.split('\n').filter(Boolean);
  const dayMap = {'周一':1,'周二':2,'周三':3,'周四':4,'周五':5,'周六':6,'周日':0};
  let imported = 0;
  for (const line of lines) {
    const m = line.match(/(周[一二三四五六日])\s+(\d{1,2}:\d{2}[-~]\d{1,2}:\d{2})\s+(.+)/);
    if (!m) continue;
    const wd = dayMap[m[1]];
    const time = m[2];
    const name = m[3];
    if (wd===undefined) continue;
    try {
      let level = '', danceType = '';
      const lvM = name.match(/[（(](.+?)[）)]$/);
      if (lvM) {
        const tag = lvM[1];
        if (['入门','中阶','高阶','高级','初中级','初阶'].includes(tag)) level = tag;
        else danceType = tag;
      }
      if (!danceType) {
        if (name.includes('爵士')) danceType = 'Jazz';
        else if (name.includes('韩舞')||name.includes('女团')) danceType = 'K-pop';
        else if (name.includes('HIPHOP')||name.includes('街舞')) danceType = 'Hiphop';
        else if (name.includes('钢管')) danceType = '钢管';
        else if (name.includes('软开')) danceType = '软开';
        else if (name.includes('私教')||name.includes('定制')) danceType = '私教';
        else if (name.includes('舞蹈通识')) danceType = '舞蹈通识';
        else if (name.includes('抖音')) danceType = '抖音舞';
        else danceType = '舞蹈';
      }
      await API.post('/api/templates', { weekday: wd, time, courseName: name.replace(/[（(].+?[）)]$/,''),
        danceType, level, teacher: '' });
      imported++;
    } catch(e){ console.log('import error:', e.message); }
  }
  UI.toast(`成功导入 ${imported} 条课程`, 'ok');
  document.getElementById('importModal').remove();
  this.loadSchedule();
};

// ===== 导航 =====
App._prevMonth = function(){this._schedMonth--;if(this._schedMonth<1){this._schedMonth=12;this._schedYear--;}this._schedWeekIdx=0;this.loadSchedule();};
App._nextMonth = function(){this._schedMonth++;if(this._schedMonth>12){this._schedMonth=1;this._schedYear++;}this._schedWeekIdx=0;this.loadSchedule();};
App._gotoWeek = function(idx){this._schedWeekIdx=idx;this.loadSchedule();};

// ===== 清空个人课表 =====
App._clearPersonalSchedule = async function() {
  const ok = await UI.modal('🗑 清空个人课表', '将清空所有已添加的个人课程（不影响舞蹈室原始课表），此操作可恢复。', '确认清空', '取消');
  if (!ok) return;
  localStorage.setItem('dance_personal_schedule', '[]');
  UI.toast('已清空', 'ok');
  this.loadSchedule();
};

// ===== 弹窗模式选择课程加入个人课表 =====
App._showAddCourseModal = async function(prefillWeekday, prefillTime) {
  // 拉取所有模板
  let templates = [];
  try {
    const data = await API.get('/api/templates');
    templates = data.templates || [];
  } catch(e) { UI.toast('加载课程失败', 'err'); return; }
  if (templates.length === 0) {
    UI.toast('还没有可用的舞蹈室课程', 'err');
    return;
  }
  const existing = JSON.parse(localStorage.getItem('dance_personal_schedule') || '[]');
  const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
  // 按 weekday+time 排序
  templates.sort((a,b) => a.weekday - b.weekday || (a.time||'').localeCompare(b.time||''));

  // 选中的课
  let selectedTpl = null;

  // 弹窗HTML
  const modal = document.createElement('div');
  modal.className = 'mdl';
  modal.id = 'addCourseModal';
  modal.innerHTML = `<div class="mdl-box" style="width:min(420px,94vw);padding:0;max-height:88vh;display:flex;flex-direction:column">
    <div style="padding:18px 20px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bd-light)">
      <div style="font-size:16px;font-weight:800">➕ 添加课程到个人课表</div>
      <span style="cursor:pointer;color:var(--t3);font-size:20px;line-height:1" onclick="document.getElementById('addCourseModal').remove()">×</span>
    </div>
    <div style="padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;background:var(--bg)">
      <select class="inp" id="acmFilterDay" style="flex:1;min-width:80px;padding:6px 8px;font-size:12px" onchange="App._renderAcmList()">
        <option value="-1">全部星期</option>
        ${dayNames.map((n,i)=>`<option value="${i}">${n}</option>`).join('')}
      </select>
      <input class="inp" id="acmFilterKw" placeholder="🔍 搜索课程名" style="flex:2;min-width:120px;padding:6px 10px;font-size:12px" oninput="App._renderAcmList()">
    </div>
    <div id="acmList" style="flex:1;overflow-y:auto;padding:6px 12px"></div>
    <div style="padding:12px 16px;border-top:1px solid var(--bd-light);display:flex;gap:8px">
      <button class="btn btn-ghost btn-b" style="flex:1" onclick="document.getElementById('addCourseModal').remove()">取消</button>
      <button class="btn btn-p btn-b" style="flex:2" id="acmConfirmBtn" onclick="App._confirmAddCourse()" disabled>选择课程 (0)</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  this._acmTemplates = templates;
  this._acmExisting = existing;
  this._acmSelected = new Set();
  if (prefillWeekday != null) document.getElementById('acmFilterDay').value = prefillWeekday;
  this._renderAcmList();
};

App._renderAcmList = function() {
  const dayF = parseInt(document.getElementById('acmFilterDay').value);
  const kw = (document.getElementById('acmFilterKw').value || '').toLowerCase();
  const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
  const list = this._acmTemplates.filter(t => {
    if (dayF >= 0 && t.weekday !== dayF) return false;
    if (kw && !(t.courseName||'').toLowerCase().includes(kw) && !(t.danceType||'').toLowerCase().includes(kw)) return false;
    return true;
  });
  const existing = this._acmExisting;
  const el = document.getElementById('acmList');
  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3);font-size:13px">没有匹配的课程</div>';
  } else {
    el.innerHTML = list.map((c, idx) => {
      const s = ds(c.danceType);
      // 已存在的
      const added = existing.some(e => e.weekday===c.weekday && e.time===c.time && e.courseName===c.courseName);
      const isSel = this._acmSelected.has(idx);
      return `<div class="acm-item ${isSel?'on':''} ${added?'added':''}" data-idx="${idx}" onclick="App._toggleAcmItem(${idx})"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin:4px 0;border-radius:10px;background:var(--bg2);border:1.5px solid ${isSel?'var(--clr)':'var(--bd-light)'};cursor:${added?'not-allowed':'pointer'};opacity:${added?.6:1}">
        <div style="width:6px;align-self:stretch;border-radius:3px;background:${s.tag};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.courseName}</div>
          <div style="font-size:11px;color:var(--t3);margin-top:2px">${dayNames[c.weekday]} ${c.time||''} · ${s.icon} ${c.danceType||'舞蹈'} ${c.level?'· '+c.level:''}</div>
        </div>
        ${added?'<span style="font-size:10px;color:var(--green);font-weight:700">已添加</span>':(isSel?'<span style="font-size:18px;color:var(--clr)">✓</span>':'')}
      </div>`;
    }).join('');
  }
  // 更新确认按钮
  const cnt = this._acmSelected.size;
  const btn = document.getElementById('acmConfirmBtn');
  if (btn) {
    btn.disabled = cnt === 0;
    btn.textContent = cnt > 0 ? `添加 ${cnt} 节到个人课表` : '选择课程 (0)';
  }
};

App._toggleAcmItem = function(idx) {
  const c = this._acmTemplates[idx];
  const existing = this._acmExisting;
  if (existing.some(e => e.weekday===c.weekday && e.time===c.time && e.courseName===c.courseName)) {
    UI.toast('已在个人课表中', 'err');
    return;
  }
  if (this._acmSelected.has(idx)) this._acmSelected.delete(idx);
  else this._acmSelected.add(idx);
  this._renderAcmList();
};

App._confirmAddCourse = function() {
  const selected = [...this._acmSelected].map(i => this._acmTemplates[i]).filter(Boolean);
  if (selected.length === 0) return;
  let personal = JSON.parse(localStorage.getItem('dance_personal_schedule') || '[]');
  let added = 0;
  selected.forEach(c => {
    const dup = personal.some(p => p.weekday===c.weekday && p.time===c.time && p.courseName===c.courseName);
    if (dup) return;
    personal.push({
      id: 'p_'+Date.now()+'_'+c.weekday+'_'+c.time,
      courseName: c.courseName,
      time: c.time,
      weekday: c.weekday,
      danceType: c.danceType,
      level: c.level,
      teacher: c.teacher || '',
      addedAt: U.today()
    });
    added++;
  });
  localStorage.setItem('dance_personal_schedule', JSON.stringify(personal));
  document.getElementById('addCourseModal').remove();
  UI.toast(`已添加 ${added} 节课`, 'ok');
  this.loadSchedule();
};

// 单元格"+"号点击 → 弹窗
App._quickAdd = function(d, t) {
  const wd = new Date(d).getDay();
  this._showAddCourseModal(wd, t);
};
App._showAddForm = function() { this._showAddCourseModal(); };

// ===== 编辑/保存/删除 =====
App._editTemplate=function(id){API.get(`/api/templates/${id}`).then(data=>{const c=data.template;if(!c){UI.toast('课程不存在','err');return;}const m=document.createElement('div');m.className='mdl';m.id='editTplModal';m.innerHTML=`<div class="mdl-box" style="width:min(360px,90vw);padding:24px"><div class="mdl-t" style="margin-bottom:16px">✏️ 编辑课程</div><div class="inp-g"><label class="inp-l">课程名称</label><input class="inp" id="etName" value="${c.courseName}"></div><div class="inp-g"><label class="inp-l">时间</label><input class="inp" id="etTime" value="${c.time||''}"></div><div class="inp-g"><label class="inp-l">舞种</label><input class="inp" id="etType" value="${c.danceType||''}"></div><div class="inp-g"><label class="inp-l">程度</label><select class="inp" id="etLevel">${['入门','中阶','高阶'].map(l=>`<option ${c.level===l?'selected':''}>${l}</option>`).join('')}</select></div><div class="inp-g"><label class="inp-l">老师</label><input class="inp" id="etTeacher" value="${c.teacher||''}"></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-p" style="flex:1" onclick="App._saveEdit(${id})">💾 保存</button><button class="btn btn-danger" style="flex:1" onclick="App._delTemplate(${id});document.getElementById('editTplModal').remove()">🗑 删除</button></div><button class="btn btn-ghost btn-b" style="margin-top:8px" onclick="document.getElementById('editTplModal').remove()">取消</button></div>`;document.body.appendChild(m);}).catch(e=>UI.toast('加载失败','err'));};
App._saveEdit=async function(id){try{await API.put(`/api/templates/${id}`,{courseName:document.getElementById('etName').value.trim(),time:document.getElementById('etTime').value.trim(),danceType:document.getElementById('etType').value.trim(),level:document.getElementById('etLevel').value,teacher:document.getElementById('etTeacher').value.trim()});document.getElementById('editTplModal').remove();UI.toast('已更新','ok');await this.loadSchedule();}catch(e){UI.toast(e.message||'更新失败','err');}};
App._saveTemplate=async function(){const name=document.getElementById('impName').value.trim();if(!name){UI.toast('请输入课程名称','err');return;}try{await API.post('/api/templates',{weekday:parseInt(document.getElementById('impDay').value),time:document.getElementById('impTime').value,courseName:name,teacher:document.getElementById('impTeacher').value,danceType:document.getElementById('impType').value,level:document.getElementById('impLevel').value});UI.toast('已添加 ✨','ok');document.getElementById('addForm').style.display='none';await this.loadSchedule();}catch(e){UI.toast(e.message||'添加失败','err');}};
App._delTemplate=async function(id){const ok=await UI.modal('⚠️ 删除课程','确定删除此课程吗？','删除','取消');if(!ok)return;try{await API.del(`/api/templates/${id}`);UI.toast('已删除','ok');await this.loadSchedule();}catch(e){UI.toast(e.message||'删除失败','err');}};
