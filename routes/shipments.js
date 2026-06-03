const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/shipments
router.get('/', async (req, res) => {
  try {
    const shipments = await db.all('SELECT * FROM shipments ORDER BY created_at DESC');
    if (shipments.length) {
      const ids = shipments.map(s => s.id);
      const placeholders = ids.map(() => '?').join(',');
      const toys = await db.all(`SELECT * FROM toys WHERE shipment_id IN (${placeholders})`, ids);
      const byShipment = new Map();
      for (const t of toys) {
        if (!byShipment.has(t.shipment_id)) byShipment.set(t.shipment_id, []);
        byShipment.get(t.shipment_id).push(t);
      }
      for (const s of shipments) {
        s.toys = byShipment.get(s.id) || [];
        s.toy_count = s.toys.length;
      }
    }
    res.json(shipments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shipments
router.post('/', async (req, res) => {
  try {
    const { name, total_weight, total_intl_shipping, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await db.insert(
      'INSERT INTO shipments (name, total_weight, total_intl_shipping, notes) VALUES (?, ?, ?, ?)',
      [name, total_weight || 0, total_intl_shipping || 0, notes || null]
    );
    const shipment = await db.get('SELECT * FROM shipments WHERE id = ?', [id]);
    res.json(shipment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/shipments/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, status, total_weight, total_intl_shipping, arrived_date, notes } = req.body;
    db.update(
      'UPDATE shipments SET name=?, status=?, total_weight=?, total_intl_shipping=?, arrived_date=?, notes=? WHERE id=?',
      [name, status, total_weight || 0, total_intl_shipping || 0, arrived_date || null, notes || null, req.params.id]
    );
    const shipment = await db.get('SELECT * FROM shipments WHERE id = ?', [req.params.id]);
    res.json(shipment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/shipments/:id
router.delete('/:id', async (req, res) => {
  try {
    // 先解绑关联商品
    db.update('UPDATE toys SET shipment_id = NULL WHERE shipment_id = ?', [req.params.id]);
    db.update('DELETE FROM shipments WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
