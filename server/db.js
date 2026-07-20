// 舞力打卡 - 数据库初始化 (v2.0 稳定版)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'dance.db');

let db = null;
let initError = null;

function getDb() {
  if (db) {
    try {
      // 验证连接是否仍然有效
      db.prepare('SELECT 1').get();
      return db;
    } catch (err) {
      console.log('[DB] 连接已失效，重新初始化...');
      db = null;
    }
  }

  try {
    // 确保数据目录存在
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 打开数据库
    db = new Database(DB_PATH);

    // 启用WAL模式提高并发性能
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    initTables();

    console.log('[DB] 已初始化:', DB_PATH);
    initError = null;
    return db;
  } catch (err) {
    console.error('[DB] 初始化失败:', err.message);
    initError = err;
    throw err;
  }
}

function initTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        nickname TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        danceLevel TEXT DEFAULT 'beginner',
        danceTypes TEXT DEFAULT '[]',
        freeTime TEXT DEFAULT '[]',
        loginCode TEXT DEFAULT '',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT DEFAULT '我的舞蹈卡',
        type TEXT NOT NULL DEFAULT 'period',
        totalPrice REAL NOT NULL DEFAULT 0,
        targetPrice REAL NOT NULL DEFAULT 0,
        startDate TEXT,
        endDate TEXT,
        totalSessions INTEGER DEFAULT 0,
        usedLessons INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekday INTEGER NOT NULL,
        time TEXT DEFAULT '',
        courseName TEXT NOT NULL,
        teacher TEXT DEFAULT '',
        danceType TEXT DEFAULT '',
        level TEXT DEFAULT '',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cardId INTEGER NOT NULL,
        templateId INTEGER,
        courseDate TEXT NOT NULL,
        courseName TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'done',
        absentReason TEXT DEFAULT '',
        photo TEXT DEFAULT '',
        location TEXT DEFAULT '',
        note TEXT DEFAULT '',
        video TEXT DEFAULT '',
        stars INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (cardId) REFERENCES cards(id)
      );
    `);
    seedTemplates();
    console.log('[DB] 表结构就绪');
  } catch (err) {
    console.error('[DB] 创建表失败:', err.message);
    throw err;
  }
}

function seedTemplates() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM templates').get();
  if (count.cnt > 0) { console.log('[DB] 课程数据已存在，跳过种子'); return; }

  const now = Date.now();
  const courses = [
    // 周二
    [2,'10:50-12:00','定制私教','私教','',''],
    [2,'14:00-15:10','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [2,'15:20-16:30','爵士舞A1-1(中阶成品舞)','Jazz','中阶',''],
    [2,'16:30-17:40','钢管技巧初中级','钢管','初中级',''],
    [2,'19:00-20:15','软开(竖叉)','软开','',''],
    [2,'19:00-20:10','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [2,'20:30-22:00','爵士舞C1-1(常规进阶)','Jazz','中阶',''],
    [2,'20:30-21:40','钢管技巧初中级','钢管','初中级',''],
    // 周三
    [3,'10:50-12:00','定制私教','私教','',''],
    [3,'14:00-15:10','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [3,'15:20-16:30','爵士舞C1-1(中阶成品舞)','Jazz','中阶',''],
    [3,'16:30-17:40','钢管技巧初中级','钢管','初中级',''],
    [3,'19:00-20:15','软开(肩腰)','软开','',''],
    [3,'19:00-20:10','爵士舞A1-1(常规进阶)','Jazz','中阶',''],
    [3,'20:30-22:00','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [3,'20:30-21:40','街舞HIPHOP(基础)','Hiphop','入门',''],
    // 周四
    [4,'10:50-12:00','定制私教','私教','',''],
    [4,'14:00-15:10','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [4,'16:30-17:40','软开(横叉)','软开','',''],
    [4,'19:00-20:15','抖音网红舞C1-1(中阶成品舞)','抖音舞','中阶',''],
    [4,'19:00-20:10','舞蹈通识A(基本功分离)','舞蹈通识','中阶',''],
    [4,'20:30-22:00','爵士舞A1-1(常规进阶)','Jazz','中阶',''],
    [4,'20:30-21:40','钢管竞技赛事中高级','钢管','高级',''],
    // 周五
    [5,'10:50-12:00','定制私教','私教','',''],
    [5,'14:00-15:10','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [5,'16:30-17:40','钢管技巧初中级','钢管','初中级',''],
    [5,'19:00-20:15','韩舞女团1-2(常规成品舞)','K-pop','中阶',''],
    [5,'19:00-20:10','舞蹈通识A(基本功分离)','舞蹈通识','中阶',''],
    [5,'20:30-22:00','舞蹈通识A(基本功分离)','舞蹈通识','中阶',''],
    [5,'20:30-21:40','钢管竞技赛事中高级','钢管','高级',''],
    // 周六
    [6,'10:50-12:00','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [6,'14:00-15:10','韩舞女团1-2(中阶段成品舞)','K-pop','中阶',''],
    [6,'14:00-15:00','CHUC爵士教师资格指导课','Jazz','高级',''],
    [6,'15:20-16:30','爵士舞C1-1(中阶成品舞)','Jazz','中阶',''],
    [6,'15:30-16:30','软开(竖叉)','软开','',''],
    [6,'16:30-17:40','钢管系列自由拍摄','钢管','',''],
    [6,'19:00-20:15','韩舞女团1-2(常规成品舞)','K-pop','中阶',''],
    [6,'19:00-20:10','舞蹈通识A(基本功分离)','舞蹈通识','中阶',''],
    [6,'19:00-20:30','街舞HIPHOP','Hiphop','中阶',''],
    [6,'20:30-22:00','街舞HIPHOP(齐舞)','Hiphop','中阶',''],
    [6,'20:30-21:40','钢管技巧初中级','钢管','初中级',''],
    // 周日
    [0,'10:50-12:00','定制私教','私教','',''],
    [0,'14:00-15:10','韩舞女团2-2(中阶段自由拍摄)','K-pop','中阶',''],
    [0,'14:00-15:00','爵士教练练1-1提高A','Jazz','高级',''],
    [0,'15:20-16:30','爵士舞B1-1(中阶成品舞)','Jazz','中阶',''],
    [0,'15:00-16:30','爵士教练班空舞(吊环)','Jazz','高级',''],
    [0,'16:30-17:40','钢管技巧初中级','钢管','初中级',''],
    [0,'19:00-20:15','韩舞女团2-2(常规自由拍摄)','K-pop','中阶',''],
    [0,'19:00-20:10','街舞HIPHOP特训课','Hiphop','高阶',''],
    [0,'19:00-20:30','街舞HIPHOP','Hiphop','中阶',''],
    [0,'20:30-22:00','舞蹈通识C(舞蹈片段入门)','舞蹈通识','入门',''],
    [0,'20:30-21:40','老师团队拍摄视频','拍摄','',''],
  ];

  const insert = db.prepare(`INSERT INTO templates (weekday,time,courseName,danceType,level,teacher,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)`);
  db.transaction(() => { courses.forEach(c => insert.run(...c, now, now)); })();
  console.log(`[DB] 种子数据导入: ${courses.length} 节课程`);
}

function close() {
  if (db) {
    try {
      db.close();
      console.log('[DB] 连接已关闭');
    } catch (err) {
      console.error('[DB] 关闭失败:', err.message);
    } finally {
      db = null;
    }
  }
}

module.exports = { getDb, close };
