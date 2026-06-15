// 舞力打卡 - UI组件
const UI = {
  // Toast提示
  toast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast toast-${type || 'info'} show`;
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 2500);
  },

  // 确认弹窗
  async modal(title, content, ok, cancel) {
    return new Promise(resolve => {
      const m = document.createElement('div');
      m.className = 'mdl';
      m.innerHTML = `<div class="mdl-box">
        <div class="mdl-t">${title}</div>
        <div class="mdl-c">${content}</div>
        <div class="mdl-a">
          ${cancel ? `<button class="btn btn-o btn-sm m-cancel">${cancel}</button>` : ''}
          <button class="btn btn-p btn-sm m-ok">${ok || '确定'}</button>
        </div>
      </div>`;
      document.body.appendChild(m);
      m.querySelector('.m-ok').onclick = () => { m.remove(); resolve(true); };
      const c = m.querySelector('.m-cancel');
      if (c) c.onclick = () => { m.remove(); resolve(false); };
      m.onclick = (e) => { if (e.target === m) { m.remove(); resolve(false); } };
    });
  },

  // 显示加载状态
  showLoading(el, text) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--t3)">
      <div class="spinner" style="margin:0 auto 8px"></div>
      <div style="font-size:12px">${text || '加载中...'}</div>
    </div>`;
  },

  // 空状态
  empty(icon, title, subtitle) {
    return `<div class="empty">
      <div class="empty-ico">${icon || '📭'}</div>
      <div class="empty-t">${title || '暂无数据'}</div>
      ${subtitle ? `<div class="empty-s">${subtitle}</div>` : ''}
    </div>`;
  }
};
