const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  // Schema
  db.run(`
    CREATE TABLE IF NOT EXISTS toys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      source TEXT NOT NULL DEFAULT 'domestic',
      cost REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'stock',
      sell REAL DEFAULT 0,
      huabei REAL DEFAULT 0,
      refund_amount REAL DEFAULT 0,
      extra_cost REAL DEFAULT 0,
      sold_date TEXT,
      done_date TEXT,
      exchange_rate REAL DEFAULT 0,
      japan_price_jpy REAL DEFAULT 0,
      japan_price_cny REAL DEFAULT 0,
      handling_fee REAL DEFAULT 0,
      japan_domestic_shipping REAL DEFAULT 0,
      intl_shipping REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      proxy_price REAL DEFAULT 0,
      proxy_intl_shipping REAL DEFAULT 0,
      proxy_domestic_shipping REAL DEFAULT 0,
      domestic_price REAL DEFAULT 0,
      domestic_shipping REAL DEFAULT 0,
      logistics_type TEXT DEFAULT '',
      logistics_fee REAL DEFAULT 0,
      logistics_tracking TEXT DEFAULT '',
      logistics_weight REAL DEFAULT 0,
      logistics_region TEXT DEFAULT '',
      box_size TEXT DEFAULT '',
      box_fee REAL DEFAULT 0,
      packing_fee REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS supplies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'box',
      unit_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      unit TEXT DEFAULT '个',
      low_stock_threshold INTEGER DEFAULT 5,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS supply_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supply_id INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      reason TEXT,
      toy_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shipping_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_name TEXT NOT NULL,
      provinces TEXT NOT NULL,
      first_weight REAL NOT NULL DEFAULT 1.0,
      first_price REAL NOT NULL DEFAULT 5,
      additional_weight REAL NOT NULL DEFAULT 1.0,
      additional_price REAL NOT NULL DEFAULT 2
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Default categories
  const rc0 = queryOne("SELECT COUNT(*) as c FROM settings WHERE key='categories'"); if (!rc0 || rc0.c === 0) {
    db.run("INSERT INTO settings (key, value) VALUES ('categories', '软胶,模型,手办,盲盒,其他')");
  }

  // Default shipping rules
  const rc1 = queryOne("SELECT COUNT(*) as c FROM shipping_rules"); if (!rc1 || rc1.c === 0) {
    const defaultRules = [
      ['一区','江苏,浙江,上海,安徽',1.0,4,1.0,2],
      ['二区','北京,天津,河北,福建,江西,山东,河南,湖北,湖南,广东',1.0,5,1.0,2],
      ['三区','山西,陕西,辽宁,吉林,广西,海南,重庆,四川,贵州,云南,黑龙江',1.0,5,1.0,2],
      ['四区','内蒙古,甘肃,青海,宁夏',1.0,8,1.0,3],
      ['五区','新疆,西藏',1.0,15,1.0,10],
    ];
    const insertRule = db.prepare("INSERT INTO shipping_rules (region_name,provinces,first_weight,first_price,additional_weight,additional_price) VALUES (?,?,?,?,?,?)");
    for (const r of defaultRules) insertRule.run(r);
    insertRule.free();
  }

  // Default supplies
  const rc2 = queryOne("SELECT COUNT(*) as c FROM supplies"); if (!rc2 || rc2.c === 0) {
    const defaultSupplies = [
      ['大纸箱','box',0,0,'个',5],
      ['中纸箱','box',0,0,'个',5],
      ['小纸箱','box',0,0,'个',5],
      ['气泡垫/胶带','packing',0,0,'份',5],
    ];
    const insertSupply = db.prepare("INSERT INTO supplies (name,category,unit_price,stock,unit,low_stock_threshold) VALUES (?,?,?,?,?,?)");
    for (const s of defaultSupplies) insertSupply.run(s);
    insertSupply.free();
  }

  saveDB();
  console.log('DB ready');
}

function saveDB() {
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buf);
}

function rowToObj(columns, values) {
  const obj = {};
  columns.forEach((c, i) => obj[c] = values[i]);
  return obj;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(rowToObj(stmt.getColumnNames(), stmt.get()));
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { lastId: db.exec("SELECT last_insert_rowid()")[0]?.[0]?.[0] || 0 };
}

// ============ API ============

// Toys
app.get('/api/toys', (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM toys WHERE 1=1';
  const params = [];
  if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY id DESC';
  res.json(queryAll(sql, params));
});

app.post('/api/toys', (req, res) => {
  const t = req.body;
  db.run(`INSERT INTO toys (
    date, name, category, source, cost, status,
    exchange_rate, japan_price_jpy, japan_price_cny, handling_fee,
    japan_domestic_shipping, intl_shipping, tax,
    proxy_price, proxy_intl_shipping, proxy_domestic_shipping,
    domestic_price, domestic_shipping,
    logistics_type, logistics_fee, logistics_tracking,
    logistics_weight, logistics_region, box_size, box_fee, packing_fee
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    t.date, t.name, t.category||'其他', t.source, t.cost||0, 'stock',
    t.exchange_rate||0, t.japan_price_jpy||0, t.japan_price_cny||0, t.handling_fee||0,
    t.japan_domestic_shipping||0, t.intl_shipping||0, t.tax||0,
    t.proxy_price||0, t.proxy_intl_shipping||0, t.proxy_domestic_shipping||0,
    t.domestic_price||0, t.domestic_shipping||0,
    t.logistics_type||'', t.logistics_fee||0, t.logistics_tracking||'',
    t.logistics_weight||0, t.logistics_region||'', t.box_size||'', t.box_fee||0, t.packing_fee||0
  ]);
  saveDB();
  const lastId = db.exec("SELECT last_insert_rowid()")[0]?.[0]?.[0];
  res.json({ id: lastId });
});

app.put('/api/toys/:id', (req, res) => {
  const t = req.body;
  db.run(`UPDATE toys SET
    date=?, name=?, category=?, source=?, cost=?,
    sell=?, huabei=?, refund_amount=?, extra_cost=?,
    sold_date=?, done_date=?, status=?,
    logistics_type=?, logistics_fee=?, logistics_tracking=?,
    logistics_weight=?, logistics_region=?, box_size=?, box_fee=?, packing_fee=?,
    updated_at=datetime('now','localtime')
    WHERE id=?`, [
    t.date, t.name, t.category, t.source, t.cost||0,
    t.sell||0, t.huabei||0, t.refund_amount||0, t.extra_cost||0,
    t.sold_date, t.done_date, t.status,
    t.logistics_type||'', t.logistics_fee||0, t.logistics_tracking||'',
    t.logistics_weight||0, t.logistics_region||'', t.box_size||'', t.box_fee||0, t.packing_fee||0,
    req.params.id
  ]);
  saveDB();
  res.json({ ok: true });
});

app.delete('/api/toys/:id', (req, res) => {
  db.run('DELETE FROM toys WHERE id=?', [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

// Supplies
app.post('/api/supplies', (req, res) => {
  const sup = req.body;
  db.run("INSERT INTO supplies (name,category,unit_price,stock,unit,low_stock_threshold) VALUES (?,?,?,?,?,?)",
    [sup.name, sup.category||'box', sup.unit_price||0, sup.stock||0, sup.unit||'个', sup.low_stock_threshold||5]);
  saveDB();
  const rs = db.exec("SELECT last_insert_rowid()");
  let lastId = 0;
  if (rs && rs[0] && rs[0].values && rs[0].values[0]) {
    lastId = rs[0].values[0][0];
  }
  res.json({ id: lastId });
});

app.delete('/api/supplies/:id', (req, res) => {
  db.run("DELETE FROM supplies WHERE id=?", [req.params.id]);
  saveDB();
  res.json({ ok: true });
});


app.get('/api/supplies', (req, res) => {
  res.json(queryAll('SELECT * FROM supplies ORDER BY id'));
});

app.put('/api/supplies/:id', (req, res) => {
  const s = req.body;
  db.run("UPDATE supplies SET name=?, unit_price=?, stock=?, unit=?, low_stock_threshold=?, updated_at=datetime('now','localtime') WHERE id=?",
    [s.name, s.unit_price, s.stock, s.unit, s.low_stock_threshold, req.params.id]);
  saveDB();
  res.json({ ok: true });
});

app.post('/api/supplies/:id/consume', (req, res) => {
  const { amount, reason, toy_id } = req.body;
  const sup = queryOne('SELECT * FROM supplies WHERE id=?', [req.params.id]);
  if (!sup) return res.status(404).json({ error: 'not found' });
  const newStock = Math.max(0, sup.stock - amount);
  db.run("UPDATE supplies SET stock=?, updated_at=datetime('now','localtime') WHERE id=?", [newStock, req.params.id]);
  db.run("INSERT INTO supply_logs (supply_id,change_amount,reason,toy_id) VALUES (?,?,?,?)",
    [parseInt(req.params.id), -amount, reason||'', toy_id||null]);
  saveDB();
  res.json({ ok: true, new_stock: newStock });
});

app.post('/api/supplies/:id/restock', (req, res) => {
  const { amount, reason } = req.body;
  const sup = queryOne('SELECT * FROM supplies WHERE id=?', [req.params.id]);
  if (!sup) return res.status(404).json({ error: 'not found' });
  const newStock = sup.stock + amount;
  db.run("UPDATE supplies SET stock=?, updated_at=datetime('now','localtime') WHERE id=?", [newStock, req.params.id]);
  db.run("INSERT INTO supply_logs (supply_id,change_amount,reason) VALUES (?,?,?)",
    [parseInt(req.params.id), amount, reason||'']);
  saveDB();
  res.json({ ok: true, new_stock: newStock });
});

// Supply logs
app.get('/api/supply-logs', (req, res) => {
  res.json(queryAll("SELECT sl.*, s.name as supply_name FROM supply_logs sl LEFT JOIN supplies s ON sl.supply_id=s.id ORDER BY sl.id DESC LIMIT 100"));
});

// Shipping rules
app.post('/api/shipping-rules', (req, res) => {
  const r = req.body;
  db.run("INSERT INTO shipping_rules (region_name,provinces,first_weight,first_price,additional_weight,additional_price) VALUES (?,?,?,?,?,?)",
    [r.region_name, r.provinces, r.first_weight||1, r.first_price||5, r.additional_weight||1, r.additional_price||2]);
  saveDB();
  const rs = db.exec("SELECT last_insert_rowid()");
  let lastId = 0;
  if (rs && rs[0] && rs[0].values && rs[0].values[0]) {
    lastId = rs[0].values[0][0];
  }
  res.json({ id: lastId });
});

app.delete('/api/shipping-rules/:id', (req, res) => {
  db.run("DELETE FROM shipping_rules WHERE id=?", [req.params.id]);
  saveDB();
  res.json({ ok: true });
});


app.get('/api/shipping-rules', (req, res) => {
  res.json(queryAll('SELECT * FROM shipping_rules ORDER BY id'));
});

app.put('/api/shipping-rules/:id', (req, res) => {
  const r = req.body;
  db.run('UPDATE shipping_rules SET region_name=?, provinces=?, first_weight=?, first_price=?, additional_weight=?, additional_price=? WHERE id=?',
    [r.region_name, r.provinces, r.first_weight, r.first_price, r.additional_weight, r.additional_price, req.params.id]);
  saveDB();
  res.json({ ok: true });
});

app.post('/api/shipping/calculate', (req, res) => {
  const { province, weight } = req.body;
  if (!province) return res.status(400).json({ error: 'province required' });
  const w = parseFloat(weight) || 0;
  const rules = queryAll('SELECT * FROM shipping_rules ORDER BY id');
  let matched = null;
  for (const r of rules) {
    if (r.provinces.split(',').some(p => province.includes(p.trim()))) { matched = r; break; }
  }
  if (!matched) return res.status(404).json({ error: 'no matching rule for: ' + province });
  let fee = matched.first_price;
  if (w > matched.first_weight) {
    fee += Math.ceil((w - matched.first_weight) / matched.additional_weight) * matched.additional_price;
  }
  res.json({ region: matched.region_name, fee: Math.round(fee * 100) / 100, weight: w });
});

// Settings
app.get('/api/settings', (req, res) => {
  const rows = queryAll('SELECT * FROM settings');
  const map = {};
  rows.forEach(r => map[r.key] = r.value);
  res.json(map);
});

app.put('/api/settings/:key', (req, res) => {
  db.run("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", [req.params.key, String(req.body.value)]);
  saveDB();
  res.json({ ok: true });
});

// Stats
app.get('/api/stats', (req, res) => {
  const toys = queryAll('SELECT * FROM toys');
  let totalProfit = 0, totalRevenue = 0, stockValue = 0, pending = 0, stockCount = 0, doneCount = 0;
  for (const t of toys) {
    if (t.status === 'stock') { stockValue += t.cost; stockCount++; }
    else if (t.status === 'sold') { pending++; }
    else if (t.status === 'done') {
      const received = (t.sell||0) - (t.refund_amount||0);
      totalRevenue += received;
      const profit = received - (t.huabei||0) - t.cost - (t.logistics_fee||0) - (t.box_fee||0) - (t.packing_fee||0);
      totalProfit += profit;
      doneCount++;
    }
  }
  res.json({ total_profit: Math.round(totalProfit*100)/100, total_revenue: Math.round(totalRevenue*100)/100, stock_value: Math.round(stockValue*100)/100, pending_count: pending, stock_count: stockCount, done_count: doneCount });
});

// Fallback to index.html
app.use((req, res) => {
  const idx = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.status(404).send('No front-end found. Put index.html in /opt/buy-ledger/public/');
});

const PORT = process.env.PORT || 4020;
// File upload endpoint
app.put('/api/upload-index', (req, res) => {
  const idx = path.join(__dirname, 'public', 'index.html');
  fs.writeFileSync(idx, req.body);
  res.json({ ok: true, size: req.body.length });
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log('BuyLedger running on port ' + PORT));
});
