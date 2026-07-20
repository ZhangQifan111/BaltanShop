/**
 * 把当前 data.db 导出成 SQL dump 文件（INSERT statements）
 * 目的是把数据库快照传到 git，方便重装系统后导入。
 *
 * 用法：
 *   node scripts/export-db.js [output_path]
 *
 * 默认输出: db/backups/data-dump-YYYYMMDD-HHMMSS.sql
 */

const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/database');

function escape(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  // string
  return "'" + String(value).replace(/'/g, "''") + "'";
}

(async () => {
  await getDb();
  const { exec: runSql } = require('../db/database');
  const db = (require('../db/database').getSync ? null : null);

  // 用 raw exec 拿表结构和数据
  const initSqlJs = require('sql.js');
  // 重新拿到 db 实例
  const dbInstance = require('../db/database');
  // database.js 用闭包持有 db，重新获取
  // 直接读文件最简单（data.db 已是最新，因为我们刚 await getDb 触发 migrate）
  const buf = fs.readFileSync(path.join(__dirname, '..', 'db', 'data.db'));
  const SQL = initSqlJs;
  const SQLLib = await initSqlJs();
  const database = new SQLLib.Database(buf);

  const tablesRes = database.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const tables = (tablesRes[0]?.values || []).map(r => r[0]);

  const lines = [];
  lines.push('-- buy-ledger-v2 数据库快照');
  lines.push('-- 生成时间: ' + new Date().toISOString());
  lines.push('-- 包含表: ' + tables.join(', '));
  lines.push('-- 还原方法: sqlite3 data.db < 本文件');
  lines.push('-- 或用 sql.js 读 .sql 解析执行');
  lines.push('');

  for (const t of tables) {
    // 导出 schema
    const ddlRes = database.exec(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${t.replace(/'/g, "''")}'`
    );
    const ddl = ddlRes[0]?.values[0]?.[0];
    if (ddl) {
      lines.push(ddl + ';');
      lines.push('');
    }

    // 导出数据
    const rowsRes = database.exec(`SELECT * FROM "${t}"`);
    const cols = rowsRes[0]?.columns || [];
    const rows = rowsRes[0]?.values || [];
    if (rows.length === 0) {
      lines.push(`-- (${t} 表为空)`);
      lines.push('');
      continue;
    }

    const colList = cols.map(c => `"${c}"`).join(', ');
    for (const row of rows) {
      const values = row.map(v => escape(v)).join(', ');
      lines.push(`INSERT INTO "${t}" (${colList}) VALUES (${values});`);
    }
    lines.push(`-- 共 ${rows.length} 行`);
    lines.push('');
  }

  // 索引
  const idxRes = database.exec(
    "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name"
  );
  for (const r of idxRes[0]?.values || []) {
    lines.push(r[0] + ';');
  }
  lines.push('');

  // 文件名时间戳：20260720-055852（年4 + 月2 + 日2 + 时2 + 分2 + 秒2），不带 T、不带 Z
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const outPath = process.argv[2] || path.join(__dirname, '..', 'db', 'backups', `data-dump-${ts}.sql`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`✓ 导出完成: ${outPath} (${sizeKB} KB)`);
  console.log(`  共 ${tables.length} 张表`);
  for (const t of tables) {
    const cnt = database.exec(`SELECT COUNT(*) FROM "${t}"`)[0]?.values[0]?.[0] || 0;
    console.log(`  - ${t}: ${cnt} 行`);
  }
})();