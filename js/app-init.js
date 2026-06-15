// 舞力打卡 - 应用启动入口（必须在所有模块文件之后加载）

// file:// 协议自动跳转 localhost
if (location.protocol === 'file:') {
  location.href = 'http://localhost:3099';
}

window.addEventListener('DOMContentLoaded', () => {
  App.init().catch(e => {
    console.error('[FATAL]', e);
    UI.toast('应用启动失败，请刷新页面', 'err');
  });
});
