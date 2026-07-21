// 舞力打卡 - 后端服务入口 (v2.0 稳定版)
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, close } = require('./db');

const app = express();
const PORT = process.env.PORT || 3099;

// ===== 全局错误捕获 - 最外层防护 =====
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // 记录错误但不退出，保持服务可用
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  // 记录错误但不退出
});

process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully...');
  close();
  process.exit(0);
});

// ===== 中间件 =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// 静态文件服务 - 前端
app.use(express.static(path.join(__dirname, '..')));

// ===== API路由 =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/auth'));
app.use('/api/data', require('./routes/auth'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/smart', require('./routes/templates'));

// 健康检查
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    // 简单查询验证数据库连接
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', time: new Date().toISOString(), db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: '数据库连接异常' });
  }
});

// SPA支持 - 所有其他路径返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// ===== 启动 =====
let server;

try {
  getDb(); // 初始化数据库
  server = app.listen(PORT, () => {
    console.log('=================================');
    console.log('  舞力打卡 服务已启动 (v2.0)');
    console.log('  地址: http://localhost:' + PORT);
    console.log('  API:  http://localhost:' + PORT + '/api/health');
    console.log('=================================');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('[FATAL] 端口 ' + PORT + ' 已被占用，请关闭其他实例');
    } else {
      console.error('[FATAL] 服务器错误:', err);
    }
  });
} catch (err) {
  console.error('[FATAL] 启动失败:', err);
  process.exit(1);
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[SERVER] 正在关闭服务...');
  if (server) {
    server.close(() => {
      close();
      process.exit(0);
    });
  } else {
    close();
    process.exit(0);
  }
});
