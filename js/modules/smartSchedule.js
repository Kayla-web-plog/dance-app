// 舞力打卡 - 模块4: 智能专属课表
// v4.0 极简酷炫设计

App.loadSmart = async function() {
  const container = document.getElementById('smartContent');
  if (!container) { console.error('[SMART] container not found'); return; }

  try {
    const u = this.user;
    const types = ['Jazz','Hiphop','K-pop','舞蹈通识','芭蕾','现代舞','拉丁','中国舞','街舞'];
    const utypes = u?.danceTypes || [];

    let targetVal = 5;
    if (this.card) {
      const need = Math.ceil(this.card.totalPrice / (this.card.targetPrice || 40));
      const remainMonth = Math.max(1, Math.ceil(U.remainDay(this.card.endDate) / 30));
      targetVal = Math.ceil(need / remainMonth / 4) || 5;
    }

    container.innerHTML = `
      <div class="sec-title">智能专属课表</div>
      <div class="card">
        <div class="inp-g">
          <label class="inp-l">每周目标课时</label>
          <input type="number" class="inp" id="smartTarget" value="${targetVal}" style="font-size:20px;font-weight:700;text-align:center;padding:16px">
        </div>
        <div class="inp-g">
          <label class="inp-l">偏好舞种 (多选)</label>
          <div id="smartTypes">
            ${types.map(t => `<span class="chip ${utypes.includes(t)?'on':''}" onclick="this.classList.toggle('on')">${t}</span>`).join('')}
          </div>
        </div>
        <button class="btn btn-p btn-b" onclick="App._genSmart()">生成专属课表</button>
      </div>
      <div id="smartResult" style="display:none">
        <div id="smartStatus" style="margin-bottom:12px;font-size:14px;color:var(--t2);font-weight:600"></div>
        <div id="smartWarning" style="display:none;padding:12px;background:var(--orange-ghost);border-radius:var(--r);font-size:12px;color:var(--orange);margin-bottom:12px"></div>
        <div id="smartList"></div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = UI.empty('🤖', '加载失败', e.message);
  }
};

App._genSmart = async function() {
  try {
    const target = parseInt(document.getElementById('smartTarget').value) || 5;
    const selTypes = [...document.querySelectorAll('#smartTypes .chip.on')].map(c => c.textContent);

    const data = await API.post('/api/smart/generate', { target, preferredTypes: selTypes });
    const { matched, total, warning } = data;

    document.getElementById('smartResult').style.display = 'block';
    document.getElementById('smartStatus').textContent = `匹配 ${matched.length}/${total} 节课程`;
    document.getElementById('smartList').innerHTML = matched.map((c, i) => `
      <div class="course" style="${i >= target ? 'opacity:.4' : ''}">
        <div class="course-time">${c.time || '—'}</div>
        <div class="course-info">
          <div class="course-name">${c.courseName}</div>
          <div class="course-meta">${c.danceType||''}${c.teacher?' · '+c.teacher:''} · ${U.weekdayCN(c.weekday)} · ${c.level||''}</div>
        </div>
        ${i < target ? '<span class="badge badge-purple">推荐</span>' : ''}
      </div>
    `).join('');

    if (warning) {
      document.getElementById('smartWarning').style.display = 'block';
      document.getElementById('smartWarning').textContent = warning;
    } else {
      document.getElementById('smartWarning').style.display = 'none';
    }
  } catch (e) {
    UI.toast(e.message || '生成失败', 'err');
  }
};
