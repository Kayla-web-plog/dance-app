// 舞力打卡 - 首页总览 v8.0 重构版
// 信息架构: 双环形进度 → 动态单价 → 月/周进度条 → 剩余预测 → 空状态→行动 → 推荐

App.loadHome = async function() {
  const el = document.getElementById('homeContent');
  if (!el) { console.error('[HOME] container not found'); return; }
  try {
    el.innerHTML = `<div class="home-skeleton">
      <div class="sk-block" style="height:140px;border-radius:24px;background:var(--bd-light);animation:pulse 1.5s infinite"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">${'12'.split('').map(()=>`<div style="height:60px;border-radius:14px;background:var(--bd-light);animation:pulse 1.5s infinite"></div>`).join('')}</div>
    </div>`;
    await this._buildHome(el);
  } catch (e) { el.innerHTML = UI.empty('🏠', '加载失败', e.message); }
};

App._buildHome = async function(el) {
  const [statsRes, chkData] = await Promise.all([
    API.get('/api/cards/stats').catch(() => ({ stats: {} })),
    API.get('/api/checkins?limit=200').catch(() => ({ checkins: [] }))
  ]);
  const stats = statsRes.stats || {};
  const checkins = chkData.checkins || [];

  // 用实际打卡数而非card.usedLessons（可能不准确）
  const doneCheckins = checkins.filter(c => c.status === 'done').length;
  const used = doneCheckins; // 已上课时 = 实际打卡数
  const need = stats.need || 0;
  const remainDays = stats.remainDays || 0;
  const totalPrice = stats.totalPrice || 0;
  const remainNeed = Math.max(0, need - used);
  const progress = need > 0 ? Math.min(100, Math.round((used / need) * 100)) : 0;

  // 周目标（使用用户设定的target，均值5节/周）
  const weeklyTarget = 5; // 按PRD要求固定5节/周

  // 预测完成天数：按5节/周计算
  const weeksNeeded = weeklyTarget > 0 ? Math.ceil(remainNeed / weeklyTarget) : 24;
  const daysNeeded = weeksNeeded * 7;

  // 本月/本周已上
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  let mDone = 0, wDone = 0;
  checkins.forEach(c => {
    if (c.status !== 'done') return;
    const d = new Date(c.courseDate);
    if (d >= monthStart) mDone++;
    if (d >= weekStart) wDone++;
  });
  const wTarget = weeklyTarget; // 本周目标 = 5节
  const mTarget = weeklyTarget * 4; // 本月目标 = 20节

  // 下节课后单价预测
  const hasCheckinData = used > 0;
  const targetPrice = stats.targetPrice || 40;

  // 等级
  const lvs = [{min:0,icon:'🌱',label:'萌芽'},{min:10,icon:'💪',label:'进阶'},{min:30,icon:'🔥',label:'燃起'},{min:60,icon:'⚡',label:'超燃'},{min:90,icon:'👑',label:'王者'}];
  const lv = [...lvs].reverse().find(l => used >= l.min) || lvs[0];

  let html = '';

  if (!stats.hasCard) {
    // === 无卡状态 ===
    html += `<div class="home-hero home-hero-warm">
      <div class="home-hero-icon"><svg width="40" height="40" style="color:#fff"><use href="#i-card"/></svg></div>
      <div class="home-hero-title">创建一张舞蹈卡</div>
      <div class="home-hero-sub">开始你的省钱之旅</div>
      <button class="btn home-hero-btn" onclick="App.nav('cardForm')"><svg width="16" height="16"><use href="#i-plus"/></svg> 立即创建</button>
    </div>`;
  } else if (stats.hasCard && !stats.hasTarget) {
    // === 有卡无目标 ===
    html += `<div class="home-hero">
      <div class="home-card-label">舞蹈卡已创建</div>
      <div class="home-card-name">${stats.cardName||''}</div>
      <div class="home-card-price">总金额 ¥${totalPrice} · ${stats.cardType==='period'?'期限卡':'次卡'}</div>
      <div class="home-hero-sub" style="margin-top:8px">设置期望课时单价，自动规划课表</div>
      <button class="btn home-hero-btn" onclick="App._showTargetSetup()"><svg width="16" height="16"><use href="#i-magic"/></svg> 设置期望课时单价</button>
    </div>`;
  } else {
    // ====== 主英雄区: 双环形进度 ======
    const ringTotal = need, ringDone = used;
    const ringRemain = remainDays;
    // 大环进度
    const bigPct = ringTotal > 0 ? Math.round((ringDone / ringTotal) * 100) : 0;
    // 小环进度
    const smallPct = ringTotal > 0 ? Math.min(100, Math.round((ringDone / ringTotal) * 100)) : 0;

    html += `<div class="home-hero hh-v8">
      <div class="hh-top-row">
        <span class="hh-brand">舞力打卡</span>
        <span class="hh-actions">
          <span class="hh-icon-btn" onclick="App._genShareCard()"><svg width="18" height="18"><use href="#i-share"/></svg></span>
          <span class="hh-icon-btn" onclick="App.nav('card')"><svg width="18" height="18"><use href="#i-edit"/></svg></span>
        </span>
      </div>
      <!-- 双环形进度 -->
      <div class="hh-rings">
        <div class="hh-ring-big">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="8"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="8" stroke-dasharray="${bigPct*3.267} 326.7" stroke-linecap="round" transform="rotate(-90,60,60)"/>
          </svg>
          <div class="hh-ring-big-text"><div class="hh-ring-big-num">${ringDone}</div><div class="hh-ring-big-sub">/ ${ringTotal}节</div></div>
        </div>
        <div class="hh-ring-small">
          <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--orange)" stroke-width="6" stroke-dasharray="${smallPct*2.639} 263.9" stroke-linecap="round" transform="rotate(-90,50,50)"/>
          </svg>
          <div class="hh-ring-small-text"><div class="hh-ring-small-num">${ringRemain}</div><div class="hh-ring-small-sub">剩余天数</div></div>
        </div>
      </div>
      <!-- 动态单价 -->
      <div class="hh-price-box">
        <div class="hh-price-row"><span>实际单价</span> <strong>${hasCheckinData?'¥'+Math.round(stats.actualPrice||0):'¥--'}</strong></div>
        ${hasCheckinData
          ? `<div class="hh-price-next">下一节课后降至 <span>¥${Math.round(Math.max(targetPrice, totalPrice/(used+1)))}</span></div>
             <div class="hh-price-saved">预计累计省钱: <span>¥${Math.round(Math.max(0,(targetPrice*used)-totalPrice))}</span></div>`
          : `<div class="hh-price-next">上完第一节课后单价将更新</div>`}
      </div>
    </div>`;

    // ====== 月/周进度条 ======
    html += `<div class="home-metrics v8-metrics">
      <div class="home-metric-card v8-mc">
        <div class="v8-mc-top"><span>本月已上</span><strong>${mDone} <small>/ ${mTarget}节</small></strong></div>
        <div class="v8-prog"><div class="v8-prog-fill" style="width:${mTarget>0?Math.min(100,(mDone/mTarget)*100):0}%"></div></div>
      </div>
      <div class="home-metric-card v8-mc">
        <div class="v8-mc-top"><span>本周已上</span><strong>${wDone} <small>/ ${wTarget}节</small></strong></div>
        <div class="v8-prog"><div class="v8-prog-fill" style="width:${wTarget>0?Math.min(100,(wDone/wTarget)*100):0}%"></div></div>
      </div>
    </div>`;

    // ====== 距离目标 ======
    html += `<div class="home-card v8-remain">
      <div class="v8-remain-top">
        <span>距离 <strong>${need}节</strong> 目标还差 <strong style="color:var(--orange)">${remainNeed}节</strong></span>
        <span class="v8-remain-sub">${hasCheckinData?'按当前节奏需 <strong>'+daysNeeded+'</strong> 天完成':'暂无节奏数据，建议先完成本周目标'}</span>
      </div>
      <div class="v8-prog v8-prog-large"><div class="v8-prog-fill" style="width:${progress}%"></div><span class="v8-prog-label">${used}/${need}</span></div>
    </div>`;
  }

  // ====== 空状态转行动入口 (合并为一个卡片) ======
  const hasCheckins = checkins.filter(c=>c.status==='done').length > 0;
  if (!hasCheckins) {
    html += `<div class="home-card v8-empty-acts" style="text-align:center;padding:24px 16px">
      <div style="font-size:40px;margin-bottom:12px">🎬</div>
      <div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px">开始你的第一节课</div>
      <div class="v8-empty-sub" style="font-size:12px;color:var(--t3);margin-bottom:16px;line-height:1.6">
        打卡后自动生成课程分布统计与弱项雷达图
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-p" onclick="App.nav('schedule')">📋 去预约课程</button>
        <button class="btn btn-o" onclick="App.nav('checkin')">✅ 我有课要打卡</button>
      </div>
    </div>`;
  } else {
    // 有打卡 → 显示分布+弱项
    try { html += buildDistribution(checkins); } catch(e) {}
    try { html += buildWeakAnalysis(checkins); } catch(e) {}

    // ====== 个性化推荐(有打卡记录后) ======
    try {
      const topTypes = [...new Set(checkins.filter(c=>c.status==='done').map(c=>c.danceType).filter(Boolean))];
      const allTpl = await API.get('/api/templates');
      const allCourses = allTpl.templates || [];
      // 推荐本周热门课程（优先级：已上课的舞种 > 弱项对应的软开/体能）
      const hotCourses = allCourses
        .filter(c => topTypes.includes(c.danceType) || c.danceType==='软开' || c.courseName.includes('体能'))
        .filter(c => c.weekday !== 1) // 排除周一公休
        .slice(0, 6);
      if (hotCourses.length > 0) {
        const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
        html += `<div class="home-card v8-recommend">
          <div class="home-card-header">🔥 本周推荐课程</div>
          ${hotCourses.map(c => {
            const s = ds(c.danceType);
            return `<div class="v8-rec-item" onclick="App.nav('schedule')" style="border-left:3px solid ${s.tag}">
              <div>${dayNames[c.weekday]} ${c.time||''}</div>
              <div class="v8-rec-name">${c.courseName}</div>
              <div class="v8-rec-tag">${s.danceType||''}</div>
            </div>`;
          }).join('')}
        </div>`;
      }
    } catch(e) {}
  }

  // ====== 今日课表 ======
  try {
    const today = U.today();
    const tplData = await API.get(`/api/templates/week?start=${today}&end=${today}`);
    const courses = ((tplData.days||[]).find(d => {
      const dt = new Date(d.date); return dt.getDay() === new Date().getDay();
    })?.courses || []).slice(0, 5);
    if (courses.length > 0) {
      html += `<div class="home-card v8-today">
        <div class="home-card-header">📋 今日课表 <span class="home-card-badge">${courses.length}节</span>
          <button class="btn btn-ghost btn-xs" style="margin-left:auto" onclick="App.nav('schedule')">全部课表 →</button>
        </div>
        ${courses.map(c => {
          const s = ds(c.danceType);
          return `<div class="v8-today-item" onclick="App.nav('checkin')" style="border-left:3px solid ${s.tag}">
            <div class="v8-today-time">${c.time||''}</div>
            <div class="v8-today-name">${c.courseName}</div>
            <div class="v8-today-type">${s.icon} ${c.danceType||''}</div>
            <div class="v8-today-go">打卡→</div>
          </div>`;
        }).join('')}
      </div>`;
    }
  } catch(e) {}

  // ====== 激励信息 + 分享战报浮窗 ======
  if (stats.hasCard && stats.hasTarget && used > 0) {
    html += `<div class="home-card v8-motivate">
      <span style="font-size:13px;color:var(--t2)">每完成一节课，单价再降一点！</span>
      <span class="v8-badge-preview">${used}节 · ${lv.icon} ${lv.label} · 上满10节解锁"入门舞者"徽章</span>
    </div>
    <!-- 分享战报浮窗 -->
    <div class="v8-share-float" onclick="App._genShareCard()">
      <svg width="18" height="18"><use href="#i-share"/></svg>
      <span>分享战报</span>
    </div>`;
  }

  el.innerHTML = html;
};

// ===== DS helper for distribution/weak analysis =====
function ds(dt) {
  const DANCE_STYLES = {
    'Jazz': {gradient:'#f472b6',light:'rgba(244,114,182,.08)',tag:'#f472b6',icon:'🩰'},
    'K-pop': {gradient:'#a78bfa',light:'rgba(167,139,250,.08)',tag:'#a78bfa',icon:'💃'},
    'Hiphop': {gradient:'#60a5fa',light:'rgba(96,165,250,.08)',tag:'#60a5fa',icon:'🕺'},
    '钢管': {gradient:'#c084fc',light:'rgba(192,132,252,.08)',tag:'#c084fc',icon:'💫'},
    '软开': {gradient:'#34d399',light:'rgba(52,211,153,.08)',tag:'#34d399',icon:'🧘'},
    '舞蹈通识': {gradient:'#fbbf24',light:'rgba(251,191,36,.08)',tag:'#fbbf24',icon:'📖'},
    '抖音舞': {gradient:'#fb7185',light:'rgba(251,113,133,.08)',tag:'#fb7185',icon:'📱'},
    '私教': {gradient:'#94a3b8',light:'rgba(148,163,184,.08)',tag:'#94a3b8',icon:'👩‍🏫'},
    '拍摄': {gradient:'#818cf8',light:'rgba(129,140,248,.08)',tag:'#818cf8',icon:'📷'},
    'default': {gradient:'#a78bfa',light:'rgba(167,139,250,.08)',tag:'#a78bfa',icon:'💃'}
  };
  return DANCE_STYLES[dt] || DANCE_STYLES['default'];
}

// ===== 分享战报浮窗 (一键生成分享卡片) =====
App._genShareCard = async function() {
  try {
    const data = await API.get('/api/achievements/summary');
    const s = data.summary || {};
    const used = s.totalDone || 0;
    const remain = s.remainDays || 0;
    const saved = s.totalDone > 0 ? Math.abs((s.targetPrice||40)*s.totalDone - (s.totalPrice||0)) : 0;

    // 随机励志文案
    const quotes = [
      { text: '越跳越美，越跳越省！', sub: '每一步都是进步' },
      { text: '舞者没有休息日', sub: '今天的汗水是明天的光芒' },
      { text: '坚持热爱，奔赴山海', sub: '舞蹈是我最好的投资' },
      { text: '不是因为优秀才坚持', sub: '而是因为坚持才优秀' },
      { text: '每一个动作都算数', sub: '每一次打卡都值得' },
      { text: '舞力全开，省钱有道', sub: '用汗水浇灌梦想' },
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    // 图片列表：本地Kpop图 + 远程风景/城市/夜景图
    const bgImages = [
      'assets/images/Kpop_dance_studio_scene__purpl_2026-06-10T10-07-57.png',
      'assets/images/Kpop_dance_idol_silhouette__pu_2026-06-10T10-43-08.png',
      'assets/images/kpop_dance_silhouette__female__2026-06-10T10-43-56.png',
      'https://picsum.photos/seed/dance1/400/600',
      'https://picsum.photos/seed/dance2/400/600',
      'https://picsum.photos/seed/citynight/400/600',
      'https://picsum.photos/seed/ocean/400/600',
    ];
    const bgUrl = bgImages[Math.floor(Math.random() * bgImages.length)];

    const modal = document.createElement('div'); modal.className = 'mdl';
    modal.innerHTML = `<div class="mdl-box" style="text-align:center;width:min(360px,90vw);padding:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">📤 分享战报</div>
      <div class="sh-card-preview" style="
        background:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.55)),url('${bgUrl}') center/cover;
        border-radius:16px;padding:24px;color:#fff;margin-bottom:16px;
        min-height:260px;display:flex;flex-direction:column;justify-content:center;
      ">
        <div style="font-size:13px;opacity:.7;margin-bottom:4px">舞力打卡 · 战报</div>
        <div style="font-size:36px;font-weight:800;margin:8px 0">已上${used}节</div>
        <div style="display:flex;justify-content:center;gap:20px;margin:8px 0">
          <div><div style="font-size:20px;font-weight:700">${remain}</div><div style="font-size:10px;opacity:.6">剩余天数</div></div>
          <div><div style="font-size:20px;font-weight:700">¥${Math.round(saved)}</div><div style="font-size:10px;opacity:.6">累计省钱</div></div>
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.25)">
          <div style="font-size:14px;font-weight:600">"${quote.text}"</div>
          <div style="font-size:11px;opacity:.7;margin-top:4px">${quote.sub}</div>
        </div>
        <div style="font-size:10px;opacity:.5;margin-top:8px">${U.today()}</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-b" style="flex:1" onclick="this.closest('.mdl').remove()">关闭</button>
        <button class="btn btn-p btn-b" style="flex:1" onclick="App.nav('share');this.closest('.mdl').remove()">查看完整海报</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  } catch(e) { UI.toast('加载失败', 'err'); }
};

// ===== 分布统计 =====
function buildDistribution(checkins) {
  const done = checkins.filter(c => c.status === 'done');
  if (done.length === 0) return '';
  const catMap = {};
  done.forEach(c => {
    const cat = c.danceType || '其他';
    catMap[cat] = (catMap[cat] || 0) + 1;
  });
  const cats = Object.entries(catMap).sort((a,b) => b[1] - a[1]);
  const total = done.length;
  const colors = ['#f472b6','#a78bfa','#60a5fa','#c084fc','#34d399','#fbbf24'];
  const top3 = cats.slice(0, 3);
  return `<div class="home-card"><div class="home-card-header">📊 课程分布统计 <span class="home-card-badge">共${total}节</span></div>
    <div class="home-dist-top">${top3.map(([cat,cnt],i) => `<div class="home-dist-bar" style="flex:${cnt}">
      <div class="home-dist-bar-fill" style="height:${Math.round(cnt/total*100)}%;background:${colors[i]}"></div>
      <div class="home-dist-bar-label">${cat}<span>${cnt}节</span></div>
    </div>`).join('')}</div>
    <div class="home-dist-list">${cats.map(([cat,cnt],i) => `<div class="home-dist-item"><span class="home-dist-dot" style="background:${colors[i]}"></span><span class="home-dist-name">${cat}</span><span class="home-dist-count">${cnt}节</span></div>`).join('')}</div></div>`;
}

// ===== 弱项分析 =====
function buildWeakAnalysis(checkins) {
  const done = checkins.filter(c => c.status === 'done');
  if (done.length === 0) return '';
  const weakKeys = [
    {key:'体力',words:['累','体力','喘','没力','虚']},
    {key:'爆发',words:['爆发','力量','发力','控制','核心']},
    {key:'记动作',words:['记不住','动作','忘记','乱','跟不上']},
    {key:'柔韧',words:['柔韧','软','拉伸','开','疼']},
    {key:'节奏',words:['节奏','拍','律动','卡点','音']},
    {key:'表情',words:['表情','表现力','眼神','气场','感染力']},
    {key:'协调',words:['协调','手脚','配合','左右']}
  ];
  const cnt = {};
  done.forEach(c => {
    const note = (c.note||'').toLowerCase();
    weakKeys.forEach(k => {
      if (k.words.some(w => note.includes(w))) cnt[k.key] = (cnt[k.key]||0) + 1;
    });
  });
  const ranked = Object.entries(cnt).sort((a,b) => b[1] - a[1]);
  const top3 = ranked.slice(0, 3);
  return `<div class="home-card home-card-accent"><div class="home-card-header">🔍 近30日弱项报告</div>
    <div class="home-weak-focus">重点练习：${top3.map(([k,n],i) => `<span class="home-weak-key" style="color:var(--${i===0?'clr':i===1?'accent':'orange'})">${k}×${n}</span>`).join(' ')}</div>
    <div class="home-weak-tags">${ranked.slice(0,8).map(([k,n]) => `<span class="home-weak-tag">${k} ×${n}</span>`).join('')}</div></div>`;
}

// ===== 目标设置弹窗 =====
App._showTargetSetup = async function() {
  const modal = document.createElement('div'); modal.className = 'mdl';
  modal.innerHTML = `<div class="mdl-box" style="width:min(360px,90vw);padding:20px">
    <div style="font-size:16px;font-weight:700;margin-bottom:16px">🎯 设置期望课时单价</div>
    <div class="inp-g"><label class="inp-l">期望单价 (¥/节)</label><input class="inp" id="targetPrice" type="number" value="40" min="10" max="200"></div>
    <div style="font-size:12px;color:var(--t3);margin:4px 0 16px">目标越低，需要上的课越多，省钱效果越明显</div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost btn-b" style="flex:1" onclick="this.closest('.mdl').remove()">取消</button>
      <button class="btn btn-p btn-b" style="flex:1" onclick="App._saveTarget()">确认设置</button>
    </div></div>`;
  document.body.appendChild(modal);
};

App._saveTarget = async function() {
  const price = parseFloat(document.getElementById('targetPrice').value) || 40;
  try {
    await API.put('/api/cards/target', { targetPrice: price });
    document.querySelectorAll('.mdl').forEach(m => m.remove());
    UI.toast('目标已设置', 'ok');
    App.nav('home');
  } catch(e) { UI.toast(e.message || '保存失败', 'err'); }
};