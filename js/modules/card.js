// 舞力打卡 - 模块2: 舞蹈卡管理
// v4.0 极简酷炫设计

App._cardType = 'period';

// ---- 舞蹈卡列表 ----
App.loadCards = async function() {
  const container = document.getElementById('cardList');
  if (!container) { console.error('[CARDS] container not found'); return; }

  try {
    const data = await API.get('/api/cards');
    const cards = data.cards || [];
    if (!cards.length) {
      container.innerHTML = `
        <div class="card-warm" style="text-align:center;padding:36px 24px;border-radius:24px">
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
            <svg width="28" height="28" style="color:#fff"><use href="#i-card"/></svg>
          </div>
          <div style="font-size:17px;font-weight:700;margin-bottom:6px">还没有舞蹈卡</div>
          <div style="font-size:13px;opacity:.75">创建一张卡开始省钱之旅</div>
          <button class="btn" style="margin-top:18px;background:rgba(255,255,255,.2);color:#fff;box-shadow:none;border:1.5px solid rgba(255,255,255,.3)" onclick="App.nav('cardForm')">
            <svg width="16" height="16"><use href="#i-plus"/></svg> 立即创建
          </button>
        </div>`;
      return;
    }
    container.innerHTML = cards.map(c => {
      const remain = U.remainDay(c.endDate);
      const prog = c.usedLessons > 0 ? Math.round((c.usedLessons / Math.ceil(c.totalPrice / (c.targetPrice || 40))) * 100) : 0;
      return `
        <div class="card-hero" style="cursor:pointer;padding:20px 22px;margin-bottom:12px" onclick="App.nav('cardForm',{cid:${c.id}})">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;position:relative;z-index:1">
            <span style="font-weight:700;font-size:17px">${c.name}</span>
            <span class="badge" style="background:rgba(255,255,255,.2);color:#fff">${c.status==='active'?'使用中':'已过期'}</span>
          </div>
          <div style="display:flex;gap:20px;margin:10px 0;position:relative;z-index:1">
            <div style="text-align:center"><div style="font-size:22px;font-weight:800">${U.money(c.totalPrice)}</div><div style="font-size:10px;opacity:.6">总额</div></div>
            <div style="text-align:center"><div style="font-size:22px;font-weight:800">${c.usedLessons||0}节</div><div style="font-size:10px;opacity:.6">已上</div></div>
            <div style="text-align:center"><div style="font-size:22px;font-weight:800">${c.type==='period' ? remain+'天' : (c.totalSessions||0)+'次'}</div><div style="font-size:10px;opacity:.6">${c.type==='period'?'剩余':'共'}</div></div>
          </div>
          <div style="position:relative;z-index:1">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:11px;opacity:.5">目标 ¥${c.targetPrice}/节</span>
              <span style="font-size:11px;opacity:.7">${prog}%</span>
            </div>
            <div class="prog-bar"><div class="prog-fill" style="width:${Math.min(100,prog)}%"></div></div>
          </div>
        </div>`;
    }).join('') + `
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-p btn-b" onclick="App.nav('cardForm')">
          <svg width="16" height="16"><use href="#i-plus"/></svg> 创建新卡
        </button>
      </div>`;
  } catch (e) {
    container.innerHTML = UI.empty('💳', '加载失败', e.message);
  }
};

// ---- 创建/编辑表单 ----
App.loadCardForm = async function(params) {
  const container = document.getElementById('cardFormContent');
  if (!container) { console.error('[CARDFORM] container not found'); return; }

  let c = null;
  if (params && params.cid) {
    try {
      const data = await API.get(`/api/cards/${params.cid}`);
      c = data.card;
    } catch (e) { /* ignore */ }
  }

  const isEdit = !!c;
  container.innerHTML = `
    <div class="sec-title">${isEdit ? '编辑舞蹈卡' : '创建舞蹈卡'}</div>
    <div class="card">
      <div class="inp-g">
        <label class="inp-l">卡片名称</label>
        <input class="inp" id="cfName" value="${c ? (c.name||'') : ''}" placeholder="我的舞蹈卡">
      </div>
      <div class="inp-g">
        <label class="inp-l">总金额 (元)</label>
        <input type="number" class="inp" id="cfPrice" value="${c ? c.totalPrice : '4800'}" placeholder="4800">
      </div>
      <div class="inp-g">
        <label class="inp-l">卡种类型</label>
        <div style="display:flex;gap:8px">
          <span class="chip ${(!c||c.type==='period')?'on':''}" id="cfTypePeriod" onclick="App._selCardType('period')">期限卡</span>
          <span class="chip ${(c&&c.type==='session')?'on':''}" id="cfTypeSession" onclick="App._selCardType('session')">次卡</span>
        </div>
      </div>
      <div class="inp-g" id="cfPeriodG" style="${c&&c.type==='session'?'display:none':''}">
        <label class="inp-l">有效期</label>
        <select class="inp" id="cfPeriod">
          <option value="90" ${c&&U.remainDay(c.endDate)<=95?'selected':''}>季卡 (90天)</option>
          <option value="180" ${(!c||U.remainDay(c.endDate)>95&&U.remainDay(c.endDate)<=185)?'selected':''}>半年卡 (180天)</option>
          <option value="365" ${c&&U.remainDay(c.endDate)>185?'selected':''}>年卡 (365天)</option>
        </select>
      </div>
      <div class="inp-g">
        <label class="inp-l">开卡日期</label>
        <input type="date" class="inp" id="cfStartDate" value="${c ? (c.startDate||U.today()) : U.today()}">
        <div style="font-size:11px;color:var(--t3);margin-top:4px">影响"剩余天数"和"已开卡时长"倒计时</div>
      </div>
      <div class="inp-g" id="cfSessionG" style="${(!c||c.type==='period')?'display:none':''}">
        <label class="inp-l">总次数</label>
        <input type="number" class="inp" id="cfSessions" value="${c&&c.type==='session'?c.totalSessions:'50'}">
      </div>
    </div>
    <button class="btn btn-p btn-b" onclick="App._saveCard(${c ? c.id : 'null'})">${isEdit ? '更新舞蹈卡' : '创建舞蹈卡'}</button>
  `;
  this._cardType = c ? c.type : 'period';
};

App._selCardType = function(type) {
  this._cardType = type;
  document.getElementById('cfTypePeriod').classList.toggle('on', type === 'period');
  document.getElementById('cfTypeSession').classList.toggle('on', type === 'session');
  document.getElementById('cfPeriodG').style.display = type === 'period' ? '' : 'none';
  document.getElementById('cfSessionG').style.display = type === 'session' ? '' : 'none';
};


App._saveCard = async function(editId) {
  const name = document.getElementById('cfName').value.trim() || '我的舞蹈卡';
  const price = parseFloat(document.getElementById('cfPrice').value) || 0;
  if (price <= 0) { UI.toast('请输入总金额', 'err'); return; }

  // 创建时不传targetPrice，设为0表示未设置
  const cardData = { name, type: this._cardType, totalPrice: price, targetPrice: 0 };

  if (this._cardType === 'period') {
    const days = parseInt(document.getElementById('cfPeriod').value) || 180;
    const userStart = document.getElementById('cfStartDate').value || U.today();
    cardData.startDate = userStart;
    // 结束日期 = 开卡日期 + 有效期天数
    const endD = new Date(userStart + 'T00:00:00');
    endD.setDate(endD.getDate() + days);
    cardData.endDate = U.fmtDate(endD);
  } else {
    cardData.totalSessions = parseInt(document.getElementById('cfSessions').value) || 0;
  }

  try {
    if (editId) {
      await API.put(`/api/cards/${editId}`, cardData);
      UI.toast('已更新!', 'ok');
      await App.nav('card');
    } else {
      const data = await API.post('/api/cards', cardData);
      App.card = data.card;
      UI.toast('创建成功! 请设置期望课时单价', 'ok');
      // 创建成功后跳转到首页，首页会显示设置期望课时的引导
      await App.nav('home');
    }
  } catch (e) {
    UI.toast(e.message || '保存失败', 'err');
  }
};
