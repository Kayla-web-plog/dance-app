// 舞力打卡 - 模块6: 社交分享&激励
// v8.3 真实图片背景 + 目标单价突出显示 + 随机励志文案

App.loadShare = async function() {
  const container = document.getElementById('shareContent');
  if (!container) { console.error('[SHARE] container not found'); return; }

  try {
    const data = await API.get('/api/achievements/summary');
    const s = data.summary || {};

    container.innerHTML = `
      <!-- 海报区域 -->
      <div class="sha-poster" id="posterBox"></div>

      <!-- 分享操作按钮 (60dp等高) -->
      <div class="sha-actions">
        <div class="sha-act" onclick="App._shareSave()">
          <div class="sha-act-ico sha-save"><svg width="22" height="22" style="color:#fff"><use href="#i-share"/></svg></div>
          <div class="sha-act-lbl">保存</div>
        </div>
        <div class="sha-act" onclick="App._shareWechat()">
          <div class="sha-act-ico sha-wechat"><svg width="22" height="22" style="color:#fff"><use href="#i-wechat"/></svg></div>
          <div class="sha-act-lbl">微信</div>
        </div>
        <div class="sha-act" onclick="App._shareMoments()">
          <div class="sha-act-ico sha-moments"><svg width="22" height="22" style="color:#fff"><use href="#i-share"/></svg></div>
          <div class="sha-act-lbl">朋友圈</div>
        </div>
      </div>
    `;

    // 生成海报
    if (s.hasCard) {
      App._genPoster(s);
    } else {
      document.getElementById('posterBox').innerHTML = `
        <div class="card" style="text-align:center;padding:24px">
          <svg width="36" height="36" style="color:var(--t4);margin-bottom:8px"><use href="#i-share"/></svg>
          <div style="font-size:14px;font-weight:600;color:var(--t2)">暂无数据</div>
          <div style="font-size:12px;color:var(--t3);margin-top:4px">创建舞蹈卡并打卡后生成海报</div>
        </div>`;
    }
  } catch (e) {
    container.innerHTML = UI.empty('📤', '加载失败', e.message);
  }
};

App._genPoster = function(s) {
  const canvas = document.createElement('canvas');
  const W = 320, H = 520;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 图片列表：本地Kpop图 + 远程风景图
  const bgImages = [
    'assets/images/Kpop_dance_studio_scene__purpl_2026-06-10T10-07-57.png',
    'assets/images/Kpop_dance_idol_silhouette__pu_2026-06-10T10-43-08.png',
    'assets/images/kpop_dance_silhouette__female__2026-06-10T10-43-56.png',
    'https://picsum.photos/seed/poster1/320/520',
    'https://picsum.photos/seed/poster2/320/520',
    'https://picsum.photos/seed/nightcity/320/520',
    'https://picsum.photos/seed/ocean/320/520',
  ];
  const imgIdx = Math.floor(Math.random() * bgImages.length);
  const bgImg = new Image();
  bgImg.crossOrigin = 'Anonymous';
  bgImg.src = bgImages[imgIdx];

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

  const targetPrice = s.targetPrice || 40;
  const saved = s.totalDone > 0 ? Math.abs(targetPrice * s.totalDone - (s.totalPrice||0)) : 0;
  const actualPrice = s.totalDone > 0 ? (s.totalPrice||0) / s.totalDone : 0;

  function drawPoster() {
    // 绘制背景图（50%透明度）
    ctx.globalAlpha = 0.5;
    ctx.drawImage(bgImg, 0, 0, W, H);
    ctx.globalAlpha = 1.0;

    // 半透明黑色蒙层
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, W, H);

    // 装饰圆
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.arc(280, 50, 100, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 470, 80, 0, Math.PI*2); ctx.fill();

    // 标题
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('舞力打卡', 160, 55);

    // 卡片名称
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(s.cardName || '我的舞蹈卡', 160, 85);

    // ===== 核心数据：目标单价（大字突出）=====
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('目标单价', 160, 140);

    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('¥' + targetPrice, 160, 195);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillText(s.totalDone > 0 ? ('实际单价 ¥' + Math.round(actualPrice)) : '实际单价 ¥--', 160, 220);

    // 分割线
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 245); ctx.lineTo(280, 245); ctx.stroke();

    // 数据行
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillText('已上课时: ' + (s.totalDone||0) + '节', 160, 275);
    ctx.fillText('累计省钱: ¥' + Math.round(saved), 160, 300);
    ctx.fillText('出勤率: ' + (s.rate||'0%'), 160, 325);

    // 励志文案
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#fff';
    const words = quote.text.split('');
    let x = 160 - (ctx.measureText(quote.text).width) / 2;
    ctx.fillText('"' + quote.text + '"', 160, 420);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText(quote.sub, 160, 445);

    // 日期
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillText(U.today(), 160, 480);

    const posterBox = document.getElementById('posterBox');
    if (posterBox) { posterBox.innerHTML = ''; posterBox.appendChild(canvas); }
  }

  bgImg.onload = drawPoster;
  bgImg.onerror = function() {
    // fallback: 渐变背景
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#9955FF'); grad.addColorStop(1, '#FF77BB');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    drawPoster();
  };
};

App._shareSave = function() {
  const canvas = document.querySelector('#posterBox canvas');
  if (!canvas) { UI.toast('请先生成海报', 'err'); return; }
  const a = document.createElement('a');
  a.download = '舞力打卡_' + U.today() + '.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
  UI.toast('海报已保存', 'ok');
};

App._shareWechat = function() {
  UI.toast('请长按海报保存后分享到微信', 'ok');
};

App._shareMoments = function() {
  UI.toast('请长按海报保存后分享到朋友圈', 'ok');
};
