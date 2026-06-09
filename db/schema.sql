-- buy-ledger v2 数据库 Schema
-- 所有 toys 记录采购全流程，purchase_orders 废除，合并到 toys 表

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source TEXT,
  contact TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS toys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '其他',
  source TEXT DEFAULT 'direct',   -- direct/proxy/domestic/secondhand
  status TEXT DEFAULT 'procurement', -- procurement/transit/stock/sold/done/returned

  -- 采购基础
  supplier_id INTEGER,
  purchase_date TEXT,
  supplier_name TEXT,

  -- 直购
  japan_price_jpy REAL DEFAULT 0,
  japan_price_cny REAL DEFAULT 0,
  japan_price_includes_tax INTEGER DEFAULT 0,  -- 0=用户输入净价(不含税) 1=用户输入含税价
  japan_consumption_tax REAL DEFAULT 0,       -- 日本消费税 10%，含税=price/11, 不含税=price*0.1
  handling_fee REAL DEFAULT 0,
  japan_domestic_shipping REAL DEFAULT 0,

  -- 代购
  proxy_price REAL DEFAULT 0,
  proxy_intl_shipping REAL DEFAULT 0,
  proxy_domestic_shipping REAL DEFAULT 0,

  -- 国内 / 二手
  domestic_price REAL DEFAULT 0,
  domestic_shipping REAL DEFAULT 0,

  -- 国际
  intl_shipping REAL DEFAULT 0,
  import_duty REAL DEFAULT 0,  -- 海关税 (原字段名 tax)

  -- 仓储发货
  logistics_type TEXT DEFAULT '',
  logistics_fee REAL DEFAULT 0,
  logistics_tracking TEXT DEFAULT '',
  logistics_weight REAL DEFAULT 0,
  logistics_region TEXT DEFAULT '',
  box_size TEXT DEFAULT '',
  box_fee REAL DEFAULT 0,
  packing_fee REAL DEFAULT 0,

  -- 销售
  sell_price REAL,
  sell_date TEXT,
  huabei REAL DEFAULT 0,
  refund_amount REAL DEFAULT 0,

  -- 采购阶段（在途用）
  procurement_stage TEXT DEFAULT 'stage1', -- stage1/stage2/stage3/stocked
  stage1_date TEXT,
  stage1_amount REAL DEFAULT 0,
  stage1_note TEXT,
  stage1_jpy REAL DEFAULT 0,
  stage1_handling REAL DEFAULT 0,
  stage1_domestic_ship REAL DEFAULT 0,

  stage2_date TEXT,
  stage2_amount REAL DEFAULT 0,
  stage2_note TEXT,
  stage2_handling REAL DEFAULT 0,
  stage2_domestic_ship REAL DEFAULT 0,

  stage3_date TEXT,
  stage3_amount REAL DEFAULT 0,
  stage3_note TEXT,
  stage3_intl_ship REAL DEFAULT 0,
  stage3_tax REAL DEFAULT 0,

  -- 发货批次
  shipment_id INTEGER,

  -- 计算字段（由后端写入）
  total_cost REAL DEFAULT 0,
  profit REAL,

  -- 关联（精确指向某个巴尔坦 ref）
  baltan_ref_id TEXT,

  -- 元数据
  image TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'preparing',  -- preparing/in_transit/arrived
  total_weight REAL DEFAULT 0,
  total_intl_shipping REAL DEFAULT 0,
  arrived_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'box',
  stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT '个',
  unit_price REAL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supply_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supply_id INTEGER,
  amount INTEGER,
  reason TEXT,
  toy_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fee_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  fee_type TEXT,     -- xianyu/huabei/other
  rate REAL,
  flat_fee REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipping_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,            -- 区域名 (华南/华北/华东等)
  carrier TEXT DEFAULT 'zto',    -- zto/sf
  provinces TEXT,                -- 省份列表，逗号分隔 "广东,广西,海南"
  first_weight REAL DEFAULT 1,   -- 首重 (kg)
  first_fee REAL DEFAULT 0,      -- 首重费用 (¥)
  additional_weight REAL DEFAULT 1, -- 续重 (kg)
  additional_fee REAL DEFAULT 0,    -- 续重费用 (¥)
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS misc_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '其他',
  sell_price REAL,
  sell_date TEXT,
  profit REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  size INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7085',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS baltan_reference (
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
  character_name_zh TEXT,
  brand TEXT,
  is_custom INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monster_favorites (
  character_slug TEXT NOT NULL,
  ref_id TEXT NOT NULL DEFAULT '',
  note TEXT,
  reference_price REAL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (character_slug, ref_id)
);
INSERT OR IGNORE INTO categories (name, color) VALUES ('vinyl', '#60a5fa');
INSERT OR IGNORE INTO categories (name, color) VALUES ('plush', '#a78bfa');
INSERT OR IGNORE INTO categories (name, color) VALUES ('figure', '#34d399');
INSERT OR IGNORE INTO categories (name, color) VALUES ('other', '#6b7085');
