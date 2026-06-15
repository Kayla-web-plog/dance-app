// 舞力打卡 - 打卡/补卡 v5.2
// 修复: 日历日期→当日课表→选课补卡

App._checkinTemplate = null;
App._photoData = null;
App._videoData = null;
App._stars = 0;
App._backfillDate = null;

App.loadCheckin = async function(params) {
  const cid = document.getElementById('checkinContent');
  if (!cid) { console.error('[CHECKIN] container not found'); return; }

  // 补卡模式：从日历点击过来，params.date 是选中日期
  if (params && params.date) {
    this._backfillDate = params.date;
    return await this._showDayCoursesForBackfill(cid, params.date);
  }

  // 补卡模式：已选日期+课程
  if (params && params.tid && this._backfillDate) {
    return await this._renderBackfillForm(cid);
  }

  // 补卡模式：已选日期+课程(通过params传递课程)
  if (params && params.tid && params.backfillDate) {
    this._backfillDate = params.backfillDate;
    return await this._renderBackfillForm(cid);
  }

  // 正常打卡：指定课程
  if (params && params.tid) {
    return await this._renderCheckinForm(cid, params.tid);
  }

  // 无参数 → 今日课程列表
  try {
    const templates = await API.getTemplates();
    const todayWd = new Date().getDay();
    const todayCourses = (templates.templates||[]).filter(c => c.weekday === todayWd);
    const allCourses = templates.templates||[];

    if (allCourses.length === 0) {
      cid.innerHTML = `<div class="card" style="text-align:center;padding:40px 20px">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--clr-ghost);margin:0 auto 16px"><svg width="28" height="28" style="color:var(--clr)"><use href="#i-cal"/></svg></div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">暂无课程</div>
        <div style="font-size:13px;color:var(--t3);margin-bottom:16px">请先在课表管理中添加课程</div>
        <button class="btn btn-p" onclick="App.nav('schedule')">前往添加课程</button></div>`;
      return;
    }

    const wds = ['日','一','二','三','四','五','六'];
    cid.innerHTML = `<div class="sec-title">选择课程打卡</div>
      ${todayCourses.length > 0 ? `<div style="font-size:12px;color:var(--t3);margin-bottom:8px">今日课程(${wds[todayWd]})</div>` : ''}
      ${(todayCourses.length > 0 ? todayCourses : allCourses).map(c => `
        <div class="course" style="cursor:pointer" onclick="App.nav('checkin',{tid:${c.id}})">
          <div class="course-time">${c.time||'—'}</div>
          <div class="course-info">
            <div class="course-name">${c.courseName}</div>
            <div class="course-meta">${c.danceType||''} · ${U.weekdayCN(c.weekday)} · ${c.level||''}</div>
          </div>
          <span class="course-action">打卡</span>
        </div>`).join('')}
      ${todayCourses.length > 0 && allCourses.length > todayCourses.length ? `<div style="font-size:12px;color:var(--t3);margin:8px 0">全部课程</div>${allCourses.filter(c=>c.weekday!==todayWd).map(c=>`<div class="course" style="cursor:pointer" onclick="App.nav('checkin',{tid:${c.id}})">
        <div class="course-time">${c.time||'—'}</div><div class="course-info"><div class="course-name">${c.courseName}</div><div class="course-meta">${c.danceType||''} · ${U.weekdayCN(c.weekday)} · ${c.level||''}</div></div><span class="course-action">打卡</span></div>`).join('')}` : ''}`;
  } catch (e) {
    cid.innerHTML = UI.empty('❌', '加载失败', e.message);
  }
};

// 补卡：显示选中日期的课表
App._showDayCoursesForBackfill = async function(cid, dateStr) {
  const d = new Date(dateStr);
  const weekday = d.getDay();
  const wds = ['日','一','二','三','四','五','六'];

  try {
    const data = await API.getTemplates();
    const dayCourses = (data.templates||[]).filter(c => c.weekday === weekday);

    if (dayCourses.length === 0) {
      cid.innerHTML = `<div class="sec-title">补卡 · ${dateStr} (${wds[weekday]})</div>
        <div class="card" style="text-align:center;padding:36px 20px">
          <svg width="40" height="40" style="color:var(--t4);margin-bottom:12px"><use href="#i-cal"/></svg>
          <div style="font-size:15px;font-weight:600;margin-bottom:4px">该日无课程</div>
          <div style="font-size:13px;color:var(--t3)">可在课表管理中添加课程</div>
          <button class="btn btn-ghost btn-b" style="margin-top:16px" onclick="App.nav('checkinHistory')">返回日历</button></div>`;
      return;
    }

    cid.innerHTML = `<div class="sec-title">补卡 · ${dateStr} (${wds[weekday]})</div>
      <div style="font-size:13px;color:var(--t3);margin-bottom:12px">选择要补录的课程</div>
      ${dayCourses.map(c => `
        <div class="course" style="cursor:pointer" onclick="App.nav('checkin',{tid:${c.id},backfillDate:'${dateStr}'})">
          <div class="course-time">${c.time||'—'}</div>
          <div class="course-info">
            <div class="course-name">${c.courseName}</div>
            <div class="course-meta">${c.danceType||''} · ${c.level||''}</div>
          </div>
          <span class="course-action">补卡</span>
        </div>`).join('')}
      <button class="btn btn-ghost btn-b" style="margin-top:16px" onclick="App.nav('checkinHistory')">返回日历</button>`;
  } catch (e) {
    cid.innerHTML = UI.empty('❌', '加载失败', e.message);
  }
};

// 补卡表单（选定课程后）
App._renderBackfillForm = async function(cid) {
  let tpl = this._checkinTemplate;
  if (!tpl) {
    try {
      // 从route历史推断params
      const data = await API.getTemplates();
      tpl = (data.templates||[])[0];
    } catch(e) { cid.innerHTML = UI.empty('❌', '课程不存在'); return; }
  }

  this._photoData = null;
  this._videoData = null;
  this._stars = 0;

  const dateStr = this._backfillDate;
  cid.innerHTML = `<div class="sec-title">补卡 · ${dateStr}</div>
    <div class="card-hero" style="padding:20px 22px;margin-bottom:12px">
      <div style="font-size:18px;font-weight:700;position:relative;z-index:1">${tpl.courseName}</div>
      <div style="font-size:13px;opacity:.75;margin-top:6px;position:relative;z-index:1">${tpl.time||''} · ${tpl.danceType||''} · ${tpl.level||''}</div>
    </div>
    <div class="card">
      <div class="inp-g"><label class="inp-l">课程名称</label><input class="inp" id="bfCourseName" value="${tpl.courseName}"></div>
      <div class="inp-g"><label class="inp-l">打卡照片 (可选)</label>
        <div class="photo-box" id="bfPhotoBox" onclick="App._capturePhoto()"><span class="photo-place"><svg width="28" height="28" style="color:var(--clr);margin-bottom:4px"><use href="#i-camera"/></svg><div style="font-size:12px">拍照/上传</div></span></div></div>
      <div class="inp-g"><label class="inp-l">打卡视频 (可选)</label>
        <div class="photo-box" id="bfVideoBox" onclick="document.getElementById('bfVideoInput').click()"><span class="photo-place" id="bfVideoPlace"><svg width="28" height="28" style="color:var(--accent);margin-bottom:4px"><use href="#i-camera"/></svg><div style="font-size:12px">上传视频</div></span></div>
        <input type="file" id="bfVideoInput" accept="video/*" style="display:none" onchange="App._handleVideo(this,'bfVideoPlace')"></div>
      <div class="inp-g"><label class="inp-l">文字感受</label><textarea class="inp" id="bfNote" rows="2" placeholder="上课感受..."></textarea></div>
      ${App._buildWeakTagGroups('bfNote')}
      <div class="inp-g"><label class="inp-l">自我评分</label><div style="display:flex;gap:8px;font-size:28px;cursor:pointer" id="bfStarRow">${[1,2,3,4,5].map(s=>`<span data-s="${s}" style="color:var(--t4)">★</span>`).join('')}</div></div>
      <div class="inp-g"><label class="inp-l">自评标签</label><div id="bfTagRow">${['体力拉满','记动作快','表现力强','节奏感好','进步明显'].map(t=>`<span class="chip" data-t="${t}" onclick="this.classList.toggle('on')">${t}</span>`).join('')}</div></div>
    </div>
    <button class="btn btn-p btn-b" onclick="App._submitBackfill()">确认补卡</button>
    <button class="btn btn-ghost btn-b" style="margin-top:8px" onclick="App.nav('checkinHistory')">取消</button>`;

  const self = this;
  document.querySelectorAll('#bfStarRow span').forEach(s => {
    s.onclick = () => {
      self._stars = parseInt(s.dataset.s);
      document.querySelectorAll('#bfStarRow span').forEach((x,i) => { x.style.color = i < self._stars ? 'var(--clr)' : 'var(--t4)'; });
    };
  });
};

// 正常打卡表单
App._renderCheckinForm = async function(cid, tid) {
  try {
    const data = await API.get(`/api/templates/${tid}`);
    const tpl = data.template;
    if (!tpl) { cid.innerHTML = UI.empty('❌', '课程不存在'); return; }
    this._checkinTemplate = tpl;
    this._photoData = null; this._videoData = null; this._stars = 0; this._backfillDate = null;

    cid.innerHTML = `<div class="card-hero" style="padding:20px 22px;margin-bottom:12px">
      <div style="font-size:18px;font-weight:700;position:relative;z-index:1">${tpl.courseName}</div>
      <div style="font-size:13px;opacity:.75;margin-top:6px;position:relative;z-index:1">${tpl.time||''} · ${tpl.danceType||''} · ${tpl.level||''}</div></div>
      <div style="display:flex;gap:10px;margin:16px 0">
        <button class="btn btn-p" style="flex:1" onclick="App._showDone()"><svg width="16" height="16"><use href="#i-check"/></svg> 去上课了</button>
        <button class="btn btn-o" style="flex:1" onclick="App._showAbsent()">缺课</button></div>
      <div id="checkinDone" style="display:none"><div class="card">
        <div class="inp-g"><label class="inp-l">打卡照片 (可选)</label><div class="photo-box" id="photoBox" onclick="App._capturePhoto()"><span class="photo-place"><svg width="28" height="28" style="color:var(--clr);margin-bottom:4px"><use href="#i-camera"/></svg><div style="font-size:12px">拍照/上传</div></span></div></div>
        <div class="inp-g"><label class="inp-l">打卡视频 (可选)</label><div class="photo-box" id="videoBox" onclick="document.getElementById('videoInput').click()"><span class="photo-place" id="videoPlace"><svg width="28" height="28" style="color:var(--accent);margin-bottom:4px"><use href="#i-camera"/></svg><div style="font-size:12px">上传视频</div></span></div><input type="file" id="videoInput" accept="video/*" style="display:none" onchange="App._handleVideo(this,'videoPlace')"></div>
        <div class="inp-g"><label class="inp-l">文字感受</label><textarea class="inp" id="checkinNote" rows="2" placeholder="今天上课感觉怎么样..."></textarea></div>
        ${App._buildWeakTagGroups('checkinNote')}
        <div class="inp-g"><label class="inp-l">自我评分</label><div style="display:flex;gap:8px;font-size:28px;cursor:pointer" id="starRow">${[1,2,3,4,5].map(s=>`<span data-s="${s}" style="color:var(--t4)">★</span>`).join('')}</div></div>
        <div class="inp-g"><label class="inp-l">自评标签</label><div id="tagRow">${['体力拉满','记动作快','表现力强','节奏感好','进步明显'].map(t=>`<span class="chip" data-t="${t}" onclick="this.classList.toggle('on')">${t}</span>`).join('')}</div></div></div>
        <button class="btn btn-p btn-b" onclick="App._submitCheckin()">提交打卡</button></div>
      <div id="checkinAbsent" style="display:none"><div class="card">
        <div class="inp-g"><label class="inp-l">缺课原因</label><div id="absentR" style="display:flex;flex-wrap:wrap;gap:8px">${['加班','身体不适','临时有事','天气原因','忘记上课','其他'].map(r=>`<span class="chip" data-r="${r}" onclick="this.classList.toggle('on')">${r}</span>`).join('')}</div></div>
        <div class="inp-g"><label class="inp-l">备注</label><textarea class="inp" id="absentNote" rows="2" placeholder="补充说明..."></textarea></div></div>
        <button class="btn btn-danger btn-b" onclick="App._submitAbsent()">记录缺课</button></div>`;

    const self = this;
    document.querySelectorAll('#starRow span').forEach(s => {
      s.onclick = () => {
        self._stars = parseInt(s.dataset.s);
        document.querySelectorAll('#starRow span').forEach((x,i) => { x.style.color = i < self._stars ? 'var(--clr)' : 'var(--t4)'; });
      };
    });
  } catch (e) { cid.innerHTML = UI.empty('❌', '加载失败', e.message); }
};

// 视频处理
App._handleVideo = function(input, placeId) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 50*1024*1024) { UI.toast('视频不能超过50MB','err'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    this._videoData = reader.result;
    const p = document.getElementById(placeId);
    if (p) p.innerHTML = `<svg width="20" height="20" style="color:var(--green)"><use href="#i-check"/></svg><div style="font-size:12px;color:var(--green);margin-top:4px">${file.name}</div>`;
  };
  reader.readAsDataURL(file);
};

// 拍照
App._capturePhoto = async function() {
  const boxId = this._backfillDate ? 'bfPhotoBox' : 'photoBox';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.createElement('video'); video.srcObject = stream; await video.play();
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    this._photoData = canvas.toDataURL('image/jpeg',0.8);
    stream.getTracks().forEach(t=>t.stop());
    const box = document.getElementById(boxId);
    if (box) { box.innerHTML = `<img src="${this._photoData}" style="width:100%;height:100%;object-fit:cover">`; box.classList.add('has'); }
  } catch(e) {
    this._photoData = 'mock_'+Date.now();
    const box = document.getElementById(boxId);
    if (box) { box.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%"><svg width="32" height="32" style="color:var(--clr)"><use href="#i-camera"/></svg><span style="font-size:12px;color:var(--t3)">(暂用演示)</span></div>`; box.classList.add('has'); }
  }
};

// 提交补卡
App._submitBackfill = async function() {
  if (!this.card) {
    try { const data = await API.getCards(); const a = (data.cards||[]).find(c=>c.status==='active'); if (a) this.card = a; else { UI.toast('请先创建舞蹈卡','err'); return; } } catch(e) { UI.toast('获取舞蹈卡失败','err'); return; }
  }
  const courseName = (document.getElementById('bfCourseName')?.value || this._checkinTemplate?.courseName || '舞蹈课').trim();
  const note = document.getElementById('bfNote')?.value?.trim()||'';
  const tags = [...document.querySelectorAll('#bfTagRow .chip.on')].map(c=>c.dataset.t);
  try {
    await API.post('/api/checkins', { cardId:this.card.id, templateId:this._checkinTemplate?.id, courseName, courseDate:this._backfillDate, status:'done', photo:this._photoData, video:this._videoData, note, stars:this._stars, tags });
    UI.toast(`补卡成功! ${this._backfillDate}`,'ok');
    setTimeout(()=>this.nav('checkinHistory'),500);
  } catch(e) { UI.toast(e.message||'补卡失败','err'); }
};

App._showDone = function() { document.getElementById('checkinDone').style.display='block'; document.getElementById('checkinAbsent').style.display='none'; };
App._showAbsent = function() { document.getElementById('checkinDone').style.display='none'; document.getElementById('checkinAbsent').style.display='block'; };

App._submitCheckin = async function() {
  if (!this.card) { try { const d=await API.getCards(); const a=(d.cards||[]).find(c=>c.status==='active'); if(a)this.card=a; else{UI.toast('请先创建舞蹈卡','err');return;} } catch(e){UI.toast('获取舞蹈卡失败','err');return;} }
  const note = document.getElementById('checkinNote')?.value?.trim()||'';
  const tags = [...document.querySelectorAll('#tagRow .chip.on')].map(c=>c.dataset.t);
  try {
    await API.post('/api/checkins', { cardId:this.card.id, templateId:this._checkinTemplate?.id, courseName:this._checkinTemplate?.courseName||'舞蹈课', status:'done', photo:this._photoData, video:this._videoData, note, stars:this._stars, tags });
    // 激励动画
    App._showIncentiveToast();
    setTimeout(()=>App.nav('home'),1500);
  } catch(e) { UI.toast(e.message||'打卡失败','err'); }
};

App._submitAbsent = async function() {
  if (!this.card) { try { const d=await API.getCards(); const a=(d.cards||[]).find(c=>c.status==='active'); if(a)this.card=a; else{UI.toast('请先创建舞蹈卡','err');return;} } catch(e){UI.toast('获取舞蹈卡失败','err');return;} }
  const reasons = [...document.querySelectorAll('#absentR .chip.on')].map(c=>c.dataset.r).join(',');
  if (!reasons) { UI.toast('请选择缺课原因','err'); return; }
  const note = document.getElementById('absentNote')?.value?.trim()||'';
  try {
    await API.post('/api/checkins', { cardId:this.card.id, templateId:this._checkinTemplate?.id, courseName:this._checkinTemplate?.courseName||'舞蹈课', status:'absent', absentReason:reasons, note });
    UI.toast('已记录缺课','ok'); setTimeout(()=>this.nav('home'),500);
  } catch(e) { UI.toast(e.message||'记录失败','err'); }
};

// ===== 弱项快捷标签构建 =====
App._buildWeakTagGroups = function(targetInputId) {
  const groups = [
    { name: '通用基本功', tags: ['身体分离','胸部wave','胯部律动','定点控制','体能不足','核心不稳','节奏感差','手脚不协调','记动作慢','发力错误','形体体态'] },
    { name: '爵士舞专项', tags: ['爵士定点','甩头发力','延伸不足','JAZZ律动','身体爆发','转体不稳','框架偏小','切分卡点'] },
    { name: '韩舞女团专项', tags: ['走位出错','齐舞对齐','表情管理','细节框架','衔接卡顿','舞台定点'] },
    { name: '舞蹈通识专项', tags: ['片段记不住','基本功分离薄弱','基础站姿','手脚配合','节拍跟不上'] },
    { name: '街舞HIPHOP专项', tags: ['HIPHOP律动','bounce不足','groove偏弱','脚步律动','身体隔离','卡点失误'] },
    { name: '钢管技巧专项', tags: ['力量不足','抓管不稳','软开度不够','倒立不稳','空中控形','核心力量差'] },
    { name: '软开专项', tags: ['竖叉不足','横叉不开','肩腰僵硬','开肩困难','胯根打不开','脚背无力'] }
  ];

  return `<div class="inp-g">
    <label class="inp-l" style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
      弱项标记 (点选追加到文字)
      <span style="font-size:11px;color:var(--t3)">▼展开</span>
    </label>
    <div style="display:none;margin-top:4px">
      ${groups.map((g, gi) => `
        <div style="margin-bottom:8px">
          <div style="font-size:11px;font-weight:600;color:var(--clr);margin-bottom:4px;cursor:pointer" onclick="var n=this.nextElementSibling;n.style.display=n.style.display==='none'?'flex':'none'">▸ ${g.name}</div>
          <div style="display:none;flex-wrap:wrap;gap:4px">
            ${g.tags.map(t => `<span class="chip" style="font-size:10px;padding:3px 8px;background:var(--bg);border:1px solid var(--bd-light);cursor:pointer" onclick="App._appendWeakTag('${targetInputId}','${t}');this.style.background='var(--clr-ghost)';this.style.borderColor='var(--clr)'">${t}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
};

// 追加弱项标签到文字输入框
App._appendWeakTag = function(inputId, tag) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const current = el.value;
  const tagText = '【' + tag + '】';
  if (current.includes(tagText)) return;
  el.value = current ? current + '，' + tagText : tagText;
  el.focus();
};

// ===== 打卡激励动画 =====
App._showIncentiveToast = function() {
  document.querySelectorAll('.v8-incentive-toast').forEach(e => e.remove());
  const toast = document.createElement('div');
  toast.className = 'v8-incentive-toast';
  toast.innerHTML = `<div class="v8-it-card">
    <div class="v8-it-icon">🎉</div>
    <div class="v8-it-title">打卡成功！</div>
    <div class="v8-it-desc">单价再降一点，继续加油！</div>
    <div class="v8-it-bar"></div>
  </div>`;
  if (!document.getElementById('v8-it-css')) {
    const style = document.createElement('style');
    style.id = 'v8-it-css';
    style.textContent = `.v8-incentive-toast{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);animation:v8itIn .3s ease-out;}
.v8-it-card{background:var(--grad-hero);border-radius:24px;padding:32px;text-align:center;color:#fff;box-shadow:0 16px 48px rgba(153,85,255,.4);animation:v8itBounce .6s var(--ease-spring);}
.v8-it-icon{font-size:48px;margin-bottom:8px;animation:v8itSpin .6s ease-out;}
.v8-it-title{font-size:22px;font-weight:800;margin-bottom:4px;}
.v8-it-desc{font-size:14px;opacity:.7;}
.v8-it-bar{width:80px;height:4px;background:rgba(255,255,255,.3);border-radius:2px;margin:16px auto 0;animation:v8itBar 1.5s ease-in forwards;}
@keyframes v8itIn{from{opacity:0}to{opacity:1}}
@keyframes v8itBounce{0%{transform:scale(.5);opacity:0}50%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes v8itSpin{0%{transform:rotate(-30deg) scale(0)}100%{transform:rotate(0) scale(1)}}
@keyframes v8itBar{0%{width:0}100%{width:80px}}`;
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  setTimeout(() => { if(toast.parentNode) toast.remove(); }, 1500);
};
