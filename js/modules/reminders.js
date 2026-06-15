// 舞力打卡 - 提醒设置 v5.2

App._reminderSettings = {
  beforeClass: '30min',
  dailyReminder: false,
  dailyTime: '20:00',
  sound: 'default',
  courseIds: [] // 单课提醒列表
};

App.loadReminders = async function() {
  const container = document.getElementById('remindersContent');
  if (!container) return;

  // 从localStorage读取设置
  const saved = localStorage.getItem('dance_reminders');
  if (saved) {
    try { Object.assign(this._reminderSettings, JSON.parse(saved)); } catch(e) {}
  }

  const the = this._reminderSettings;
  const beforeOpts = [
    {v:'30min', t:'课前30分钟'},
    {v:'1hour', t:'课前1小时'},
    {v:'2hour', t:'课前2小时'},
    {v:'1day', t:'课前1天'},
    {v:'custom', t:'自定义'}
  ];
  const soundOpts = [
    {v:'default', t:'系统默认'},
    {v:'bell', t:'铃声'},
    {v:'vibrate', t:'震动'},
    {v:'silent', t:'静音'}
  ];

  container.innerHTML = `<div class="sec-title">提醒设置</div>
    <div class="card">
      <!-- 课前提醒时机 -->
      <div class="inp-g">
        <label class="inp-l">课前提醒时机</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px" id="beforeOpts">
          ${beforeOpts.map(o => `<span class="chip ${the.beforeClass===o.v?'on':''}" data-v="${o.v}" onclick="App._selBefore(this)">${o.t}</span>`).join('')}
        </div>
      </div>

      <!-- 每日提醒 -->
      <div class="inp-g">
        <label class="inp-l" style="display:flex;align-items:center;justify-content:space-between">
          <span>每日课表提醒</span>
          <span class="toggle-status ${the.dailyReminder?'on':'off'}" id="dailyToggleStatus">${the.dailyReminder?'开启':'关闭'}</span>
        </label>
        <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
          <div class="toggle-wrap" onclick="App._toggleDaily()">
            <div class="toggle-track" id="dailyTrack" style="background:${the.dailyReminder?'var(--clr)':'var(--bd)'}">
              <div class="toggle-thumb" style="transform:translateX(${the.dailyReminder?'22px':'2px'})"></div>
            </div>
          </div>
          <span style="font-size:14px;color:var(--t2)">${the.dailyReminder ? '已开启 · 每日' + the.dailyTime + '推送明日课表' : '关闭后不推送'}</span>
        </div>
        ${the.dailyReminder ? `<div class="inp-g" style="margin-top:12px">
          <label class="inp-l">提醒时间</label>
          <input type="time" class="inp" id="dailyTime" value="${the.dailyTime}" onchange="App._saveDailyTime(this.value)">
        </div>` : ''}
      </div>

      <!-- 铃声 -->
      <div class="inp-g">
        <label class="inp-l">提醒铃声</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px" id="soundOpts">
          ${soundOpts.map(o => `<span class="chip ${the.sound===o.v?'on':''}" data-v="${o.v}" onclick="App._selSound(this)">${o.t}</span>`).join('')}
        </div>
      </div>

      <!-- 单课提醒 -->
      <div class="inp-g">
        <label class="inp-l">单课独立提醒</label>
        <div style="font-size:13px;color:var(--t3);margin-bottom:12px">为每门课程单独设置提醒开关</div>
        <div id="courseReminders"></div>
      </div>
    </div>

    <button class="btn btn-p btn-b" onclick="App._saveReminders()" style="margin-top:12px">保存设置</button>
    <div style="text-align:center;padding:16px;font-size:12px;color:var(--t3)">⚠️ 提醒功能需要浏览器通知权限</div>`;

  // 加载单课提醒列表
  await this._loadCourseReminders();
};

// 加载课程提醒开关
App._loadCourseReminders = async function() {
  try {
    const data = await API.getTemplates();
    const templates = data.templates || [];
    const enabledIds = new Set(this._reminderSettings.courseIds || []);

    const el = document.getElementById('courseReminders');
    if (!el) return;

    if (templates.length === 0) {
      el.innerHTML = '<div style="color:var(--t3);font-size:13px">暂无课程，请先添加课表</div>';
      return;
    }

    // 按时间分组
    const groups = {};
    templates.forEach(c => {
      const key = c.time || '未定';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    el.innerHTML = Object.keys(groups).sort().map(time => {
      const courses = groups[time];
      return `<div style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--clr);font-weight:600;margin-bottom:6px">⏰ ${time}</div>
        ${courses.map(c => {
          const on = enabledIds.has(c.id);
          const wds = ['日','一','二','三','四','五','六'];
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd-light)">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--t1)">${c.courseName}</div>
              <div style="font-size:11px;color:var(--t3)">${wds[c.weekday]} · ${c.danceType||''} · ${c.level||''}</div>
            </div>
            <div class="toggle-wrap" onclick="App._toggleCourse(${c.id})">
              <div class="toggle-track" id="courseTrack_${c.id}" style="background:${on?'var(--clr)':'var(--bd)'}">
                <div class="toggle-thumb" style="transform:translateX(${on?'22px':'2px'})"></div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  } catch(e) { console.log('[REMINDERS] load courses error:', e); }
};

// 选择课前时机
App._selBefore = function(el) {
  document.querySelectorAll('#beforeOpts .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  this._reminderSettings.beforeClass = el.dataset.v;
};

// 选择铃声
App._selSound = function(el) {
  document.querySelectorAll('#soundOpts .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  this._reminderSettings.sound = el.dataset.v;
};

// 切换每日提醒
App._toggleDaily = function() {
  this._reminderSettings.dailyReminder = !this._reminderSettings.dailyReminder;
  const on = this._reminderSettings.dailyReminder;
  const track = document.getElementById('dailyTrack');
  const status = document.getElementById('dailyToggleStatus');
  if (track) track.style.background = on ? 'var(--clr)' : 'var(--bd)';
  if (track) track.querySelector('.toggle-thumb').style.transform = `translateX(${on?'22px':'2px'})`;
  if (status) { status.textContent = on ? '开启' : '关闭'; status.className = 'toggle-status ' + (on ? 'on' : 'off'); }
  // 重新渲染以显示/隐藏时间选择
  this.loadReminders();
};

// 切换单课提醒
App._toggleCourse = function(courseId) {
  const ids = this._reminderSettings.courseIds;
  const idx = ids.indexOf(courseId);
  if (idx >= 0) ids.splice(idx, 1);
  else ids.push(courseId);
  const on = ids.includes(courseId);
  const track = document.getElementById('courseTrack_' + courseId);
  if (track) { track.style.background = on ? 'var(--clr)' : 'var(--bd)';
    track.querySelector('.toggle-thumb').style.transform = `translateX(${on?'22px':'2px'})`; }
};

// 保存每日提醒时间
App._saveDailyTime = function(time) {
  this._reminderSettings.dailyTime = time;
};

// 保存所有设置
App._saveReminders = async function() {
  localStorage.setItem('dance_reminders', JSON.stringify(this._reminderSettings));

  // 请求通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
      console.log('[REMINDERS] notification permission:', Notification.permission);
    } catch(e) {}
  }

  UI.toast('提醒设置已保存', 'ok');
};

// 发送课前提醒 (由watchdog定时触发，此处仅作UI接口)
App._sendPreClassReminder = function(courseName, time) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('💃 舞力打卡', {
      body: `还有${this._reminderSettings.beforeClass}上课: ${courseName} · ${time}`,
      icon: '/assets/icon-192.png'
    });
  }
};
