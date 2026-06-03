const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/supplies
router.get('/', async (req, res) => {
  try {
    const supplies = await db.all('SELECT * FROM supplies ORDER BY name');
    res.json(supplies);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/supplies
router.post('/', async (req, res) => {
  try {
    const { name, category, stock, unit, unit_price, low_stock_threshold } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await db.insert(
      'INSERT INTO supplies (name, category, stock, unit, unit_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)',
      [name, category || 'box', stock || 0, unit || '个', unit_price || 0, low_stock_threshold || 5]
    );
    const supply = await db.get('SELECT * FROM supplies WHERE id = ?', [id]);
    res.json(supply);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/supplies/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, stock, unit, unit_price, low_stock_threshold } = req.body;
    db.update(
      'UPDATE supplies SET name=?, category=?, stock=?, unit=?, unit_price=?, low_stock_threshold=? WHERE id=?',
      [name, category, stock || 0, unit, unit_price || 0, low_stock_threshold || 5, req.params.id]
    );
    const supply = await db.get('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    res.json(supply);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/supplies/:id
router.delete('/:id', async (req, res) => {
  try {
    db.update('DELETE FROM supplies WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/supplies/:id/consume
router.post('/:id/consume', async (req, res) => {
  try {
    const { amount, reason, toy_id } = req.body;
    const supply = await db.get('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    if (!supply) return res.status(404).json({ error: 'Not found' });
    const newStock = Math.max(0, supply.stock - (amount || 1));
    db.update('UPDATE supplies SET stock = ? WHERE id = ?', [newStock, req.params.id]);
    db.insert(
      'INSERT INTO supply_logs (supply_id, amount, reason, toy_id) VALUES (?, ?, ?, ?)',
      [req.params.id, -(amount || 1), reason || '', toy_id || null]
    );
    const updated = await db.get('SELECT * FROM supplies WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/supplies/logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await db.all(
      'SELECT sl.*, s.name as supply_name FROM supply_logs sl LEFT JOIN supplies s ON sl.supply_id = s.id ORDER BY sl.created_at DESC LIMIT 50'
    );
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
