const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      db.update(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
        [key, String(value)]
      );
    }
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings/categories
router.get('/categories', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM categories ORDER BY id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings/categories
router.post('/categories', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await db.insert(
      'INSERT INTO categories (name, color) VALUES (?, ?)',
      [name.trim(), color || '#6b7085']
    );
    const row = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '分类已存在' });
    }
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/settings/categories/:id
router.delete('/categories/:id', async (req, res) => {
  try {
    db.update('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
