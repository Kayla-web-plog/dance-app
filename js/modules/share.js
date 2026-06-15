// 舞力打卡 - 模块6: 社交分享&激励
// v7.5 随机Kpop背景图片

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
  const W = 320, H = 480;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 图片列表：本地Kpop图 + 远程风景/城市/夜景图
  const bgImages = [
    'assets/images/Kpop_dance_studio_scene__purpl_2026-06-10T10-07-57.png',
    'assets/images/Kpop_dance_idol_silhouette__pu_2026-06-10T10-43-08.png',
    'assets/images/kpop_dance_silhouette__female__2026-06-10T10-43-56.png',
    'https://picsum.photos/seed/poster1/320/480',
    'https://picsum.photos/seed/poster2/320/480',
    'https://picsum.photos/seed/nightcity/320/480',
    'https://picsum.photos/seed/ocean/320/480',
  ];
  const imgIdx = Math.floor(Math.random() * bgImages.length);
  const bgImg = new Image();
  bgImg.crossOrigin = 'Anonymous';
  bgImg.src = bgImages[imgIdx];

  // 随机励志文案
  const quotes = [
    '越跳越美，越跳越省！',
    '舞者没有休息日',
    '坚持热爱，奔赴山海',
    '不是因为优秀才坚持',
    '每一个动作都算数',
    '舞力全开，省钱有道',
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  bgImg.onload = function() {
    // 先绘制背景图（50%透明度，清晰可见）
    ctx.globalAlpha = 0.5;
    ctx.drawImage(bgImg, 0, 0, W, H);
    ctx.globalAlpha = 1.0;

    // 覆盖半透明黑色蒙层（文字可读性 + 保留图片细节）
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, W, H);

    // 装饰圆（增加层次感）
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.arc(280, 50, 100, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 420, 80, 0, Math.PI*2); ctx.fill();

    // 标题
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('舞力打卡', 160, 55);

    // 卡片名称
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(s.cardName || '我的舞蹈卡', 160, 85);

    // 省钱金额 42号粗体
    const saved = s.totalDone > 0 ? Math.abs((s.targetPrice||40)*s.totalDone - (s.totalPrice||0)) : 0;
    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(saved > 0 ? U.money(saved) : '¥0', 160, 170);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText('累计节省', 160, 200);

    // 数据
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText(`已上课时: ${s.totalDone || 0}节`, 160, 260);
    if (s.totalDone > 0) {
      ctx.fillText(`实际单价: ${U.money((s.totalPrice||0) / s.totalDone)}`, 160, 285);
    }
    ctx.fillText(`出勤率: ${s.rate || '0%'}`, 160, 310);

    // 底部励志文案
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(quote, 160, 430);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillText(U.today(), 160, 455);

    const posterBox = document.getElementById('posterBox');
    posterBox.innerHTML = '';
    posterBox.appendChild(canvas);
  };

  bgImg.onerror = function() {
    // 图片加载失败时用渐变背景
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#9955FF');
    grad.addColorStop(0.5, '#cc66ee');
    grad.addColorStop(1, '#FF77BB');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // 重新调用onload里的绘制逻辑（不含图片）
    const fakeImg = { onload: null };
    // 直接绘制文字内容
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.arc(280, 50, 100, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 420, 80, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('舞力打卡', 160, 55);
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(s.cardName || '我的舞蹈卡', 160, 85);
    const saved = s.totalDone > 0 ? Math.abs((s.targetPrice||40)*s.totalDone - (s.totalPrice||0)) : 0;
    ctx.font = 'bold 42px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(saved > 0 ? U.money(saved) : '¥0', 160, 170);
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText('累计节省', 160, 200);
    ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText(`已上课时: ${s.totalDone || 0}节`, 160, 260);
    if (s.totalDone > 0) ctx.fillText(`实际单价: ${U.money((s.totalPrice||0) / s.totalDone)}`, 160, 285);
    ctx.fillText(`出勤率: ${s.rate || '0%'}`, 160, 310);
    ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(quote, 160, 430);
    ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillText(U.today(), 160, 455);
    const posterBox = document.getElementById('posterBox');
    posterBox.innerHTML = '';
    posterBox.appendChild(canvas);
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
