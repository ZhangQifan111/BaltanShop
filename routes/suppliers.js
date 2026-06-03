const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await db.all('SELECT * FROM suppliers ORDER BY name');
    res.json(suppliers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/suppliers
router.post('/', async (req, res) => {
  try {
    const { name, source, contact, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await db.insert(
      'INSERT INTO suppliers (name, source, contact, notes) VALUES (?, ?, ?, ?)',
      [name, source || null, contact || null, notes || null]
    );
    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    res.json(supplier);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, source, contact, notes } = req.body;
    db.update(
      'UPDATE suppliers SET name=?, source=?, contact=?, notes=? WHERE id=?',
      [name, source, contact, notes, req.params.id]
    );
    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    res.json(supplier);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/suppliers/:id
router.delete('/:id', async (req, res) => {
  try {
    db.update('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
