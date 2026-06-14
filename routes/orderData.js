const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data', 'orders');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// List saved files
router.get('/', (req, res) => {
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
  const p = path.join(DATA_DIR, req.params.name);
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
  const p = path.join(DATA_DIR, req.params.name);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
  fs.unlinkSync(p);
  res.json({ ok: true });
});

module.exports = router;
