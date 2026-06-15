// 舞力打卡 - 进程守护脚本 (Watchdog)
// 用法: node watchdog.js
// 功能: 监控主服务进程，崩溃时自动重启

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3099;
const CHECK_INTERVAL = 5000; // 5秒检查一次
const RESTART_DELAY = 3000;  // 崩溃后3秒重启

let serverProcess = null;
let restartCount = 0;
let lastRestartTime = 0;

function log(msg) {
  console.log(`[WATCHDOG] ${new Date().toISOString()} ${msg}`);
}

function startServer() {
  const now = Date.now();
  // 防止短时间内频繁重启
  if (now - lastRestartTime < 10000 && restartCount > 3) {
    log('重启过于频繁，等待30秒...');
    setTimeout(startServer, 30000);
    return;
  }

  if (now - lastRestartTime > 60000) {
    restartCount = 0; // 超过1分钟重置计数
  }

  restartCount++;
  lastRestartTime = now;

  log(`启动服务 (第${restartCount}次)...`);

  serverProcess = spawn('node', ['index.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  serverProcess.on('exit', (code, signal) => {
    log(`服务退出 code=${code} signal=${signal}`);
    serverProcess = null;
    if (code !== 0 && code !== null) {
      log('服务异常退出，准备重启...');
      setTimeout(startServer, RESTART_DELAY);
    }
  });

  serverProcess.on('error', (err) => {
    log(`服务进程错误: ${err.message}`);
    serverProcess = null;
    setTimeout(startServer, RESTART_DELAY);
  });
}

// 健康检查
function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 定期检查
async function periodicCheck() {
  const isHealthy = await healthCheck();
  if (!isHealthy && !serverProcess) {
    log('健康检查失败且服务未运行，启动服务...');
    startServer();
  } else if (!isHealthy && serverProcess) {
    log('健康检查失败但进程存在，可能假死，准备重启...');
    try {
      serverProcess.kill('SIGTERM');
    } catch (e) {
      // ignore
    }
    serverProcess = null;
    setTimeout(startServer, RESTART_DELAY);
  }
}

// 启动
log('=== 舞力打卡 进程守护启动 ===');
startServer();

// 定时健康检查
setInterval(periodicCheck, CHECK_INTERVAL);

// 优雅关闭
process.on('SIGINT', () => {
  log('收到退出信号，关闭服务...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});
