const express = require('express');
const initSqlJs = require('sql.js');
const Tesseract = require('tesseract.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('crypto');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Image upload setup ───
const IMAGES_DIR = path.join(__dirname, 'public/images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `toy_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

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
      toy_image_path TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Migration: add toy_image_path if not exists (existing DBs)
  try {
    db.run("ALTER TABLE toys ADD COLUMN toy_image_path TEXT");
  } catch (e) { /* column already exists, ignore */ }

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

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      source TEXT NOT NULL DEFAULT 'direct',
      stage1_date TEXT,
      stage1_amount REAL DEFAULT 0,
      stage1_note TEXT,
      stage2_date TEXT,
      stage2_amount REAL DEFAULT 0,
      stage2_note TEXT,
      stage3_date TEXT,
      stage3_amount REAL DEFAULT 0,
      stage3_note TEXT,
      status TEXT NOT NULL DEFAULT 'stage1',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // Default categories
  const rc0 = queryOne("SELECT COUNT(*) as c FROM settings WHERE key='categories'"); if (!rc0 || rc0.c === 0) {
    db.run("INSERT INTO settings (key, value) VALUES ('categories', '软胶,模型,手办,盲盒,其他')");
  }

  // Default profit margin
  const rcPM = queryOne("SELECT COUNT(*) as c FROM settings WHERE key='default_profit_margin'"); if (!rcPM || rcPM.c === 0) {
    db.run("INSERT INTO settings (key, value) VALUES ('default_profit_margin', '15')");
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS fee_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      box_size TEXT DEFAULT '',
      handling_fee_percent REAL DEFAULT 0,
      japan_domestic_shipping REAL DEFAULT 0,
      intl_shipping REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      domestic_shipping REAL DEFAULT 0,
      box_fee REAL DEFAULT 0,
      packing_fee REAL DEFAULT 0,
      profit_margin_percent REAL DEFAULT 15,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

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
    date, name, category, source, cost, status, sell,
    exchange_rate, japan_price_jpy, japan_price_cny, handling_fee,
    japan_domestic_shipping, intl_shipping, tax,
    proxy_price, proxy_intl_shipping, proxy_domestic_shipping,
    domestic_price, domestic_shipping,
    logistics_type, logistics_fee, logistics_tracking,
    logistics_weight, logistics_region, box_size, box_fee, packing_fee
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    t.date, t.name, t.category||'其他', t.source, t.cost||0, t.status||'stock', t.sell||0,
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
    toy_image_path=?,
    updated_at=datetime('now','localtime')
    WHERE id=?`, [
    t.date, t.name, t.category, t.source, t.cost||0,
    t.sell||0, t.huabei||0, t.refund_amount||0, t.extra_cost||0,
    t.sold_date, t.done_date, t.status,
    t.logistics_type||'', t.logistics_fee||0, t.logistics_tracking||'',
    t.logistics_weight||0, t.logistics_region||'', t.box_size||'', t.box_fee||0, t.packing_fee||0,
    t.toy_image_path || null,
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

// ─── Purchase Records (进货在途) ───

app.get('/api/purchase-records', (req, res) => {
  const list = queryAll('SELECT * FROM purchase_records ORDER BY created_at DESC');
  res.json(list);
});

app.post('/api/purchase-records', (req, res) => {
  const p = req.body;
  db.run(`INSERT INTO purchase_records (name,category,source,stage1_date,stage1_amount,stage1_note,status) VALUES (?,?,?,?,?,?,?)`,
    [p.name||'', p.category||'其他', p.source||'direct', p.stage1_date||'', p.stage1_amount||0, p.stage1_note||'', 'stage1']);
  saveDB();
  const rs = db.exec('SELECT last_insert_rowid()');
  const lastId = (rs && rs[0] && rs[0].values && rs[0].values[0]) ? rs[0].values[0][0] : 0;
  const rec = queryOne('SELECT * FROM purchase_records WHERE id=?', [lastId]);
  res.json(rec);
});

app.put('/api/purchase-records/:id/stage1', (req, res) => {
  const p = req.body;
  db.run(`UPDATE purchase_records SET stage1_date=?, stage1_amount=?, stage1_note=? WHERE id=?`,
    [p.stage1_date||'', p.stage1_amount||0, p.stage1_note||'', req.params.id]);
  saveDB();
  res.json(queryOne('SELECT * FROM purchase_records WHERE id=?', [req.params.id]));
});

app.put('/api/purchase-records/:id/stage2', (req, res) => {
  const p = req.body;
  db.run(`UPDATE purchase_records SET stage2_date=?, stage2_amount=?, stage2_note=?, status='stage2' WHERE id=?`,
    [p.stage2_date||'', p.stage2_amount||0, p.stage2_note||'', req.params.id]);
  saveDB();
  res.json(queryOne('SELECT * FROM purchase_records WHERE id=?', [req.params.id]));
});

app.put('/api/purchase-records/:id/stage3', (req, res) => {
  const p = req.body;
  const rec = queryOne('SELECT * FROM purchase_records WHERE id=?', [req.params.id]);
  if (!rec) return res.status(404).json({ error: 'Not found' });

  // Finalize the purchase record
  db.run(`UPDATE purchase_records SET stage3_date=?, stage3_amount=?, stage3_note=?, status='stocked' WHERE id=?`,
    [p.stage3_date||'', p.stage3_amount||0, p.stage3_note||'', req.params.id]);

  // Create the toy in stock with the total cost
  const totalCost = (rec.stage1_amount||0) + (rec.stage2_amount||0) + (p.stage3_amount||0);
  db.run(`INSERT INTO toys (date,name,category,source,cost,status,japan_price_cny,handling_fee,japan_domestic_shipping,intl_shipping,tax)
    VALUES (?,?,?,?,?,'stock',?,?,?,?,?)`,
    [p.stage3_date||rec.stage1_date||'', rec.name, rec.category, rec.source, totalCost,
     rec.stage1_amount||0, rec.stage2_amount||0, 0, p.stage3_amount||0]);
  saveDB();

  res.json(queryOne('SELECT * FROM purchase_records WHERE id=?', [req.params.id]));
});

app.put('/api/purchase-records/:id', (req, res) => {
  const p = req.body;
  const rec = queryOne('SELECT * FROM purchase_records WHERE id=?', [req.params.id]);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  db.run(`UPDATE purchase_records SET
    name=?, category=?, source=?,
    stage1_date=?, stage1_amount=?, stage1_note=?,
    stage2_date=?, stage2_amount=?, stage2_note=?,
    stage3_date=?, stage3_amount=?, stage3_note=?,
    status=? WHERE id=?`, [
    p.name||rec.name, p.category||rec.category, p.source||rec.source,
    p.stage1_date||rec.stage1_date, p.stage1_amount??rec.stage1_amount, p.stage1_note??rec.stage1_note,
    p.stage2_date||rec.stage2_date, p.stage2_amount??rec.stage2_amount, p.stage2_note??rec.stage2_note,
    p.stage3_date||rec.stage3_date, p.stage3_amount??rec.stage3_amount, p.stage3_note??rec.stage3_note,
    p.status||rec.status, req.params.id
  ]);
  saveDB();
  res.json(queryOne('SELECT * FROM purchase_records WHERE id=?', [req.params.id]));
});

app.delete('/api/purchase-records/:id', (req, res) => {
  db.run('DELETE FROM purchase_records WHERE id=?', [req.params.id]);
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
  const recs = queryAll("SELECT * FROM purchase_records WHERE status NOT IN ('stocked','cancelled')");
  let transitCost = 0;
  for (const r of recs) { transitCost += (r.stage1_amount||0) + (r.stage2_amount||0) + (r.stage3_amount||0); }
  let totalCost = 0, totalSell = 0, totalProfit = 0, totalRevenue = 0, stockValue = 0, pending = 0, stockCount = 0, doneCount = 0;
  for (const t of toys) {
    if (t.status === 'stock' && t.source !== 'secondhand') { stockValue += t.cost || 0; stockCount++; }
    else if (t.status === 'sold') { pending++; }
    else if (t.status === 'done') {
      const sell = t.sell || 0;
      const refund = t.refund_amount || 0;
      const received = sell - refund;
      const cost = t.cost || 0;
      const huabei = t.huabei || 0;
      const logisticFee = t.logistics_fee || 0;
      const boxFee = t.box_fee || 0;
      const packingFee = t.packing_fee || 0;
      const profit = received - huabei - cost - logisticFee - boxFee - packingFee;
      totalSell += sell;
      totalCost += cost;
      totalRevenue += received;
      totalProfit += profit;
      doneCount++;
    }
  }
  const marginRate = totalSell > 0 ? (totalProfit / totalSell * 100) : 0;
  res.json({
    total_cost: Math.round((stockValue+transitCost)*100)/100,
    total_cost_done: Math.round(stockValue*100)/100,
    total_cost_transit: Math.round(transitCost*100)/100,
    total_sell: Math.round(totalSell*100)/100,
    total_profit: Math.round(totalProfit*100)/100,
    margin_rate: Math.round(marginRate*100)/100,
    total_revenue: Math.round(totalRevenue*100)/100,
    stock_value: Math.round(stockValue*100)/100,
    pending_count: pending,
    stock_count: stockCount,
    done_count: doneCount
  });
});



// ─── Screenshot recognition (AI vision) ───

// ─── Screenshot OCR recognition (Tesseract.js) ───

/**
 * Parse OCR text to extract order info.
 * Handles common Japanese proxy app formats.
 */
function parseOcrText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {
    name: '',
    category: '其他',
    source: 'proxy',
    date: new Date().toISOString().split('T')[0],
    cost: 0,
    japan_price_jpy: 0,
    handling_fee: 0,
    intl_shipping: 0,
    japan_domestic_shipping: 0,
    tax: 0,
    currency: 'JPY',
    notes: ''
  };

  // Date: 2026/05/06 or 2026-05-06
  const dateMatch = text.match(/(\d{4})[\/年](\d{1,2})[\/月](\d{1,2})/);
  if (dateMatch) {
    result.date = `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`;
  }

  // JPY amounts: ¥8,500 / 8,500円 / ¥8500
  const jpyMatch = text.match(/[¥￥]\s*([\d,]+)\s*(?:円|JPY)/i) ||
                   text.match(/([\d,]+)\s*円(?!.*[¥￥])/);
  if (jpyMatch) {
    result.japan_price_jpy = parseInt(jpyMatch[1].replace(/,/g, ''), 10);
  }

  // CNY total
  const cnyMatch = text.match(/(?:≈|人民币|RMB)[\s:]*([\d.]+)/i) ||
                   text.match(/([\d.]+)\s*元(?!.*円)/);
  if (cnyMatch) {
    result.cost = parseFloat(cnyMatch[1]);
    result.currency = 'CNY';
  }

  // Tax (消費税込, 税金, tax)
  const taxMatch = text.match(/(?:消費税込|税込|税金|tax)[\s:]*[¥￥]?([\d,]+)/i) ||
                  text.match(/tax[\s:]*([\d,]+)/i);
  if (taxMatch) result.tax = parseFloat(taxMatch[1].replace(/,/g,''));

  // Handling fee
  const hfMatch = text.match(/(?:手数料|代行|代购费)[\s:]*[¥￥]?([\d,]+)/i);
  if (hfMatch) result.handling_fee = parseInt(hfMatch[1].replace(/,/g,''), 10);

  // International shipping (国際送料, International, 国際配送)
  const shipMatch = text.match(/(?:国際送料|国際配送|International|国际运费)[\s:]*[¥￥]?([\d,]+)/i);
  if (shipMatch) result.intl_shipping = parseFloat(shipMatch[1].replace(/,/g,''));

  // Japan domestic shipping (国内送料)
  const jpShipMatch = text.match(/(?:国内送料)[\s:]*[¥￥]?([\d,]+)/i);
  if (jpShipMatch) result.japan_domestic_shipping = parseFloat(jpShipMatch[1].replace(/,/g,''));

  // Cost fallback: use CNY total if available
  if (!result.cost && result.japan_price_jpy) {
    result.cost = Math.round(result.japan_price_jpy * 0.046 * 100) / 100;
  }

  // Category detection
  if (/ Ultraman|奥特曼|咸蛋|迪迦|杰克|赛文|艾斯/.test(text)) result.category = '软胶';
  else if (/ SHF|SHF iguarts|假面骑士/.test(text)) result.category = '手办';
  else if (/ ガレージ|ガシャ|Wonder/.test(text)) result.category = '模型';
  else if (/ フルミ|盲盒|boys|^L[io]/.test(text)) result.category = '盲盒';

  // Product name (first long line that isn't a price/date)
  for (const line of lines) {
    if (line.length > 4 && line.length < 80 &&
        !/^[¥￥\d,.]/.test(line) &&
        !/(?:合計|总计|価格|运费|送料)/.test(line) &&
        !/[\d,]+円/.test(line)) {
      result.name = line.replace(/[\r\n]/g, '').slice(0, 80);
      break;
    }
  }

  // Order number
  const orderMatch = text.match(/(?:注文|No\.?)[\s:#]*([A-Z0-9]{6,})/i);
  if (orderMatch) result.notes = '订单号: ' + orderMatch[1];

  return result;
}

// Multer for screenshot uploads
const multerScreenshot = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

app.post('/api/recognize', multerScreenshot.array('files', 5), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '请上传至少一张截图' });
  }

  try {
    const worker = await Tesseract.createWorker('jpn+eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write('\rOCR: ' + Math.round(m.progress * 100) + '%');
        }
      }
    });

    const file = req.files[0];
    const { data } = await worker.recognize(file.buffer);
    const text = data.text;
    console.log('\nOCR text:', text.slice(0, 300));
    await worker.terminate();

    const parsed = parseOcrText(text);
    console.log('Parsed:', JSON.stringify(parsed));

    res.json({ success: true, data: parsed, raw: text });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: '识别失败: ' + err.message });
  }
});

// ─── Fee Rules (买入价估算费用规则) ───
app.get('/api/fee-rules', (req, res) => {
  res.json(queryAll('SELECT * FROM fee_rules ORDER BY category, box_size'));
});

app.post('/api/fee-rules', (req, res) => {
  const r = req.body;
  db.run(`INSERT INTO fee_rules (category, box_size, handling_fee_percent, japan_domestic_shipping, intl_shipping, tax, domestic_shipping, box_fee, packing_fee, profit_margin_percent) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [r.category||'', r.box_size||'', r.handling_fee_percent||0, r.japan_domestic_shipping||0, r.intl_shipping||0, r.tax||0, r.domestic_shipping||0, r.box_fee||0, r.packing_fee||0, r.profit_margin_percent||15]);
  saveDB();
  const rs = db.exec('SELECT last_insert_rowid()');
  const lastId = (rs && rs[0] && rs[0].values && rs[0].values[0]) ? rs[0].values[0][0] : 0;
  res.json(queryOne('SELECT * FROM fee_rules WHERE id=?', [lastId]));
});

app.put('/api/fee-rules/:id', (req, res) => {
  const r = req.body;
  db.run(`UPDATE fee_rules SET category=?, box_size=?, handling_fee_percent=?, japan_domestic_shipping=?, intl_shipping=?, tax=?, domestic_shipping=?, box_fee=?, packing_fee=?, profit_margin_percent=?, updated_at=datetime('now','localtime') WHERE id=?`,
    [r.category||'', r.box_size||'', r.handling_fee_percent||0, r.japan_domestic_shipping||0, r.intl_shipping||0, r.tax||0, r.domestic_shipping||0, r.box_fee||0, r.packing_fee||0, r.profit_margin_percent||15, req.params.id]);
  saveDB();
  res.json(queryOne('SELECT * FROM fee_rules WHERE id=?', [req.params.id]));
});

app.delete('/api/fee-rules/:id', (req, res) => {
  db.run('DELETE FROM fee_rules WHERE id=?', [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

// ─── Buy Price Calculator ───
app.post('/api/calc-buy-price', (req, res) => {
  const { sell_price, category, box_size, custom_fees } = req.body;
  const sell = parseFloat(sell_price) || 0;
  if (sell <= 0) return res.status(400).json({ error: '请输入有效的咸鱼售价' });

  // Find matching fee rule
  let rule = null;
  if (category) {
    const rules = queryAll('SELECT * FROM fee_rules WHERE category=? ORDER BY box_size DESC', [category]);
    // Prefer exact box_size match, fall back to empty box_size (generic)
    rule = rules.find(r => r.box_size === box_size) || rules.find(r => !r.box_size) || rules[0] || null;
  }

  const profit_margin = custom_fees?.profit_margin_percent ?? rule?.profit_margin_percent ?? 15;
  const handling_pct = custom_fees?.handling_fee_percent ?? rule?.handling_fee_percent ?? 0;
  const japan_domestic = custom_fees?.japan_domestic_shipping ?? rule?.japan_domestic_shipping ?? 0;
  const intl = custom_fees?.intl_shipping ?? rule?.intl_shipping ?? 0;
  const tax = custom_fees?.tax ?? rule?.tax ?? 0;
  const domestic = custom_fees?.domestic_shipping ?? rule?.domestic_shipping ?? 0;
  const box_fee = custom_fees?.box_fee ?? rule?.box_fee ?? 0;
  const packing = custom_fees?.packing_fee ?? rule?.packing_fee ?? 0;

  const total_fees = japan_domestic + intl + tax + domestic + box_fee + packing;
  const handling_fee = sell * (handling_pct / 100);
  const target_profit = sell * (profit_margin / 100);
  const buy_price_max = sell - handling_fee - total_fees - target_profit;

  res.json({
    sell_price: sell,
    fee_rule: rule ? { category: rule.category, box_size: rule.box_size } : null,
    fees: {
      handling_fee: Math.round(handling_fee * 100) / 100,
      handling_fee_percent: handling_pct,
      japan_domestic_shipping: japan_domestic,
      intl_shipping: intl,
      tax: tax,
      domestic_shipping: domestic,
      box_fee: box_fee,
      packing_fee: packing,
      total_fixed_fees: Math.round(total_fees * 100) / 100
    },
    target_profit: Math.round(target_profit * 100) / 100,
    target_profit_margin: profit_margin,
    buy_price_max: Math.round(buy_price_max * 100) / 100,
    break_even: Math.round((sell - handling_fee - total_fees) * 100) / 100
  });
});

// ─── Categories & Box Sizes helpers ───
app.get('/api/categories', (req, res) => {
  const row = queryOne("SELECT value FROM settings WHERE key='categories'");
  const cats = row ? row.value.split(',').filter(Boolean) : ['其他'];
  res.json(cats);
});

app.get('/api/box-sizes', (req, res) => {
  const boxes = queryAll("SELECT DISTINCT name FROM supplies WHERE category='box' ORDER BY id");
  res.json(boxes.map(b => b.name));
});

// ─── Static files & fallback (must be AFTER all API routes) ───
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// File upload endpoint
app.put('/api/upload-index', (req, res) => {
  const idx = path.join(__dirname, 'public', 'index.html');
  fs.writeFileSync(idx, req.body);
  res.json({ ok: true, size: req.body.length });
});

// Upload / replace toy image
app.post('/api/upload-toy-image/:id', uploadImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  const toy = queryOne('SELECT * FROM toys WHERE id=?', [req.params.id]);
  if (!toy) return res.status(404).json({ error: 'Toy not found' });
  if (toy.toy_image_path) {
    const oldPath = path.join(__dirname, 'public', toy.toy_image_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const relPath = 'images/' + req.file.filename;
  db.run('UPDATE toys SET toy_image_path=?, updated_at=datetime("now","localtime") WHERE id=?', [relPath, req.params.id]);
  saveDB();
  res.json({ ok: true, path: relPath });
});

// Delete toy image
app.delete('/api/toy-image/:id', (req, res) => {
  const toy = queryOne('SELECT * FROM toys WHERE id=?', [req.params.id]);
  if (!toy) return res.status(404).json({ error: 'Toy not found' });
  if (toy.toy_image_path) {
    const fullPath = path.join(__dirname, 'public', toy.toy_image_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  db.run('UPDATE toys SET toy_image_path=NULL, updated_at=datetime("now","localtime") WHERE id=?', [req.params.id]);
  saveDB();
  res.json({ ok: true });
});

// Fallback to index.html
app.use((req, res) => {
  const idx = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.status(404).send('No front-end found. Put index.html in /opt/buy-ledger/public/');
});

const PORT = process.env.PORT || 4020;

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log('BuyLedger running on port ' + PORT));
});
