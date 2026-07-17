const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// 全局 CORS：放通浏览器侧 fetch（书签抓取脚本需要从 rennigou.jp 域 POST 到本地）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: '20mb' }));

// 静态文件（React build 输出）
const staticPath = path.join(__dirname, 'dist');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
}

// 用户上传 / 下载的图片
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// 鉴权路由（必须最先挂：login 免认证，其他路径走 requireAuth）
const authRouter = require('./routes/auth');
const { requireAuth } = authRouter;
app.use('/api/auth', authRouter);

// 全局鉴权中间件：所有 /api/*（除白名单）都要 Bearer token
// 注意：app.use('/api', ...) 下 req.path 是相对 /api 的部分
const AUTH_WHITELIST = [
  '/auth/login',
  '/ingest-renrigou',     // 任你购抓取脚本用（rennigou.jp 跨域 fetch，本地 token 拿不到）
];
app.use('/api', (req, res, next) => {
  if (AUTH_WHITELIST.includes(req.path)) return next();
  return requireAuth(req, res, next);
});

// API Routes
app.use('/api/toys', require('./routes/toys'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/supplies', require('./routes/supplies'));
app.use('/api/fee-rules', require('./routes/feeRules'));
app.use('/api/shipping-rules', require('./routes/shippingRules'));
app.use('/api/baltan', require('./routes/baltan'));
app.use('/api/monster', require('./routes/baltan'));
app.use('/api/xplus', require('./routes/xplus'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/stats', require('./routes/stats'));
const { router: backupRouter } = require('./routes/backup');
app.use('/api/backup', backupRouter);
app.use('/api/order-data', require('./routes/orderData'));
app.use('/api/fetch-renrigou', require('./routes/renrigou'));
app.use('/api/ingest-renrigou', require('./routes/ingestRenrigou'));
app.use('/api/import-renrigou', require('./routes/importRenrigou'));
app.use('/api/translate', require('./routes/translate'));
app.use('/api/process-toy-image', require('./routes/processToyImage'));

// Misc sales
const db = require('./db/database');

app.get('/api/misc-sales', async (req, res) => {
  try {
    const sales = await db.all('SELECT * FROM misc_sales ORDER BY created_at DESC');
    res.json(sales);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/misc-sales', async (req, res) => {
  try {
    const { name, category, sell_price, sell_date, profit, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await db.insert(
      'INSERT INTO misc_sales (name, category, sell_price, sell_date, profit, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [name, category || '其他', sell_price || 0, sell_date || null, profit || 0, notes || null]
    );
    const sale = await db.get('SELECT * FROM misc_sales WHERE id = ?', [id]);
    res.json(sale);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/misc-sales/:id', async (req, res) => {
  try {
    db.update('DELETE FROM misc_sales WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Catch-all: serve React (not /api/* or /uploads/*)
if (fs.existsSync(staticPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// 启动时自动备份
const { createBackup } = require('./routes/backup');

async function start() {
  await db.getDb(); // 确保 DB 初始化
  console.log('DB initialized');
  // 首次启动自动创建默认账号（仅在 users 表为空时）
  const userCount = await db.get('SELECT COUNT(*) as c FROM users');
  if (!userCount || userCount.c === 0) {
    const defaultUser = 'Baltan';
    const defaultPass = 'Zqf51126428jik!';
    const hash = await bcrypt.hash(defaultPass, 10);
    await db.insert('INSERT INTO users (username, password_hash) VALUES (?, ?)', [defaultUser, hash]);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔐 默认管理员账号已创建');
    console.log(`   用户名: ${defaultUser}`);
    console.log(`   密  码: ${defaultPass}`);
    console.log('   ⚠️  登录后请立即在「设置」修改密码！');
    console.log('═══════════════════════════════════════════════════════════');
  }
  createBackup(); // 启动时备份
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch(console.error);
