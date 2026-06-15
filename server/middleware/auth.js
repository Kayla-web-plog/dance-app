// 舞力打卡 - JWT认证中间件
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dance-app-secret-key-2026';
const JWT_EXPIRES = '7d';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请登录' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token已过期，请重新登录' });
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Token无效' });
    return res.status(401).json({ error: '认证失败' });
  }
}

module.exports = { generateToken, authMiddleware };
