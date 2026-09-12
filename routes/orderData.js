const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data', 'orders');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 文件名白名单：只允许 data/orders 下的 json 文件，防路径穿越（../、绝对路径、%2F 编码斜杠一律拒绝）
function safeOrderPath(name) {
  const base = path.basename(String(name));
  if (base !== name || !/^[\w.\-]+\.json$/.test(base)) return null;
  const p = path.join(DATA_DIR, base);
  if (!p.startsWith(DATA_DIR + path.sep)) return null;
  return p;
}

// List saved files
router.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  ensureDir();
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(DATA_DIR, f));
      return { name: f, size: stat.size, time: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.time.localeCompare(a.time));
  res.json(files);
});

// Get one
router.get('/:name', (req, res) => {
  const p = safeOrderPath(req.params.name);
  if (!p) return res.status(400).json({ error: 'invalid name' });
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
  res.type('json').send(fs.readFileSync(p, 'utf-8'));
});

// Save
router.post('/', (req, res) => {
  ensureDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `orders-${ts}.json`;
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(req.body));
  res.json({ name, ok: true });
});

// Delete
router.delete('/:name', (req, res) => {
  const p = safeOrderPath(req.params.name);
  if (!p) return res.status(400).json({ error: 'invalid name' });
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
  try { fs.unlinkSync(p); } catch(e) {
    return res.status(500).json({ error: e.message });
  }
  res.json({ ok: true });
});

module.exports = router;
