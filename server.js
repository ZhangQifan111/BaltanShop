const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4020;

app.use(express.json({ limit: '10mb' }));

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
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  },
}));

// API Routes
app.use('/api/toys', require('./routes/toys'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/supplies', require('./routes/supplies'));
app.use('/api/fee-rules', require('./routes/feeRules'));
app.use('/api/shipping-rules', require('./routes/shippingRules'));
app.use('/api/baltan', require('./routes/baltan'));
app.use('/api/monster', require('./routes/baltan'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/stats', require('./routes/stats'));
const { router: backupRouter } = require('./routes/backup');
app.use('/api/backup', backupRouter);
app.use('/api/order-data', require('./routes/orderData'));
app.use('/api/fetch-renrigou', require('./routes/renrigou'));

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
  createBackup(); // 启动时备份
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch(console.error);
