// 修复周五课程数据 (v8.3)
// 根据用户提供原始课表：
// - 周五 19:00-20:15 → 爵士舞C中阶成品舞
// - 周五 20:30-22:00 → 舞蹈通识A基本功分离

const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'dance.db');
const db = new Database(dbPath);

console.log('=== 修复前：周五所有课程 ===');
const before = db.prepare("SELECT weekday, time, courseName, danceType, level FROM templates WHERE weekday=5 ORDER BY time").all();
before.forEach(r => console.log(`  ${r.time} | ${r.courseName} | ${r.danceType} | ${r.level || '-'}`));

// 更新周五 19:00 课程
db.prepare(`
  UPDATE templates SET
    courseName = '爵士舞C中阶成品舞',
    danceType = 'Jazz',
    level = '中阶'
  WHERE weekday = 5 AND time LIKE '19:0%'
`).run();

// 更新周五 20:30 课程
db.prepare(`
  UPDATE templates SET
    courseName = '舞蹈通识A(基本功分离)',
    danceType = '舞蹈通识',
    level = '中阶'
  WHERE weekday = 5 AND time LIKE '20:30%'
`).run();

console.log('\n=== 修复后：周五所有课程 ===');
const after = db.prepare("SELECT weekday, time, courseName, danceType, level FROM templates WHERE weekday=5 ORDER BY time").all();
after.forEach(r => console.log(`  ${r.time} | ${r.courseName} | ${r.danceType} | ${r.level || '-'}`));

console.log('\n✅ 周五课程数据修复完成！');
db.close();
