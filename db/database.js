const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'data.db');

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
    runSchema();
  }
  migrate();
  return db;
}

function runSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.run(schema);
  save();
}

function migrate() {
  const colNames = new Set(
    (db.exec("PRAGMA table_info(toys)")[0]?.values || []).map(r => r[1])
  );
  const tableNames = new Set(
    (db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values || []).map(r => r[0])
  );
  const changes = [];
  if (colNames.has('tax') && !colNames.has('import_duty')) {
    changes.push("ALTER TABLE toys RENAME COLUMN tax TO import_duty");
    colNames.delete('tax');
    colNames.add('import_duty');
  }
  if (!colNames.has('japan_consumption_tax')) {
    changes.push("ALTER TABLE toys ADD COLUMN japan_consumption_tax REAL DEFAULT 0");
  }
  if (!colNames.has('japan_price_includes_tax')) {
    changes.push("ALTER TABLE toys ADD COLUMN japan_price_includes_tax INTEGER DEFAULT 0");
  }
  if (!colNames.has('baltan_ref_id')) {
    changes.push("ALTER TABLE toys ADD COLUMN baltan_ref_id TEXT");
  }
  if (!tableNames.has('shipping_rules')) {
    changes.push(`CREATE TABLE shipping_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      carrier TEXT DEFAULT 'zto',
      provinces TEXT,
      first_weight REAL DEFAULT 1,
      first_fee REAL DEFAULT 0,
      additional_weight REAL DEFAULT 1,
      additional_fee REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  }
  if (!tableNames.has('baltan_reference')) {
    changes.push(`CREATE TABLE baltan_reference (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      source TEXT NOT NULL,
      detail_url TEXT,
      image_url TEXT,
      image_big_url TEXT,
      position INTEGER DEFAULT 0,
      series TEXT,
      character_slug TEXT,
      character_name_ja TEXT,
      brand TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } else {
    const baltanCols = new Set(
      (db.exec("PRAGMA table_info(baltan_reference)")[0]?.values || []).map(r => r[1])
    );
    if (!baltanCols.has('image_url')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN image_url TEXT");
    }
    if (!baltanCols.has('image_big_url')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN image_big_url TEXT");
    }
    if (!baltanCols.has('series')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN series TEXT");
    }
    if (!baltanCols.has('character_slug')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN character_slug TEXT");
    }
    if (!baltanCols.has('character_name_ja')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN character_name_ja TEXT");
    }
    if (!baltanCols.has('brand')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN brand TEXT");
    }
    if (!baltanCols.has('is_custom')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN is_custom INTEGER DEFAULT 0");
    }
    if (!baltanCols.has('character_name_zh')) {
      changes.push("ALTER TABLE baltan_reference ADD COLUMN character_name_zh TEXT");
    }
  }
  if (!tableNames.has('monster_favorites')) {
    changes.push(`CREATE TABLE monster_favorites (
      character_slug TEXT NOT NULL,
      ref_id TEXT NOT NULL DEFAULT '',
      note TEXT,
      reference_price REAL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (character_slug, ref_id)
    )`);
  } else {
    const favCols = new Set(
      (db.exec("PRAGMA table_info(monster_favorites)")[0]?.values || []).map(r => r[1])
    );
    if (!favCols.has('reference_price')) {
      changes.push("ALTER TABLE monster_favorites ADD COLUMN reference_price REAL");
    }
  }
  // 一次性迁移：旧 ref_id 格式纯数字 "01" (无 prefix) 改为 "{slug}-{nn}"，并补 series/slug/name
  if (tableNames.has('baltan_reference')) {
    const oldFormatCount = (db.exec(
      "SELECT COUNT(*) FROM baltan_reference WHERE ref_id GLOB '[0-9]*' AND length(ref_id) <= 3"
    )[0]?.values[0]?.[0]) > 0;
    if (oldFormatCount) {
      changes.push(`UPDATE baltan_reference
        SET ref_id = CASE generation
            WHEN 1 THEN 'alienbaltan-' || ref_id
            ELSE 'alienbaltan2-' || ref_id
          END,
          series = 'ultraman',
          character_slug = CASE generation WHEN 1 THEN 'alienbaltan' ELSE 'alienbaltan2' END,
          character_name_ja = CASE generation WHEN 1 THEN 'バルタン星人' ELSE 'バルタン星人（二代目）' END
        WHERE ref_id GLOB '[0-9]*' AND length(ref_id) <= 3`);
    }
  }
  // 独立迁移：toys.baltan_ref_id 旧格式 "1-01" → "alienbaltan-01"
  if (colNames.has('baltan_ref_id')) {
    const toysOldFormat = (db.exec(
      "SELECT COUNT(*) FROM toys WHERE baltan_ref_id LIKE '1-%' OR baltan_ref_id LIKE '2-%'"
    )[0]?.values[0]?.[0]) > 0;
    if (toysOldFormat) {
      changes.push(`UPDATE toys SET baltan_ref_id = 'alienbaltan-' || substr(baltan_ref_id, 3) WHERE baltan_ref_id LIKE '1-%' AND substr(baltan_ref_id, 3) GLOB '[0-9]*'`);
      changes.push(`UPDATE toys SET baltan_ref_id = 'alienbaltan2-' || substr(baltan_ref_id, 3) WHERE baltan_ref_id LIKE '2-%' AND substr(baltan_ref_id, 3) GLOB '[0-9]*'`);
    }
  }
  for (const sql of changes) db.run(sql);
  if (changes.length) save();
}

function save() {
  if (!db) return;
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(dbPath, buf);
}

function exportBuffer() {
  if (!db) throw new Error('DB not initialized');
  return Buffer.from(db.export());
}

function run(sql, params = []) {
  getDb().then(database => {
    database.run(sql, params);
    save();
  });
}

function all(sql, params = []) {
  return getDb().then(database => {
    const stmt = database.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  });
}

function get(sql, params = []) {
  return getDb().then(database => {
    const stmt = database.prepare(sql);
    if (params.length) stmt.bind(params);
    let result = null;
    if (stmt.step()) result = stmt.getAsObject();
    stmt.free();
    return result;
  });
}

function runSync(sql, params = []) {
  // Synchronous run for save-heavy operations - uses current db state
  if (!db) throw new Error('DB not initialized');
  db.run(sql, params);
  save();
}

function allSync(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function getSync(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let result = null;
  if (stmt.step()) result = stmt.getAsObject();
  stmt.free();
  return result;
}

// Insert and return the last id
function insert(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  db.run(sql, params);
  const result = db.exec('SELECT last_insert_rowid() as id');
  save();
  return result[0]?.values[0]?.[0] || null;
}

// Update by id
function update(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  db.run(sql, params);
  save();
}

module.exports = { getDb, get, all, run, save, exportBuffer, getSync, allSync, insert, update, runSync };
