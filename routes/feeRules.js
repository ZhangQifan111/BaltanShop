const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/fee-rules
router.get('/', async (req, res) => {
  try {
    const rules = await db.all('SELECT * FROM fee_rules ORDER BY created_at');
    res.json(rules);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fee-rules
router.post('/', async (req, res) => {
  try {
    const { name, fee_type, rate, flat_fee, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await db.insert(
      'INSERT INTO fee_rules (name, fee_type, rate, flat_fee, notes) VALUES (?, ?, ?, ?, ?)',
      [name, fee_type || null, rate || 0, flat_fee || 0, notes || null]
    );
    const rule = await db.get('SELECT * FROM fee_rules WHERE id = ?', [id]);
    res.json(rule);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/fee-rules/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, fee_type, rate, flat_fee, notes } = req.body;
    db.update(
      'UPDATE fee_rules SET name=?, fee_type=?, rate=?, flat_fee=?, notes=? WHERE id=?',
      [name, fee_type, rate || 0, flat_fee || 0, notes || null, req.params.id]
    );
    const rule = await db.get('SELECT * FROM fee_rules WHERE id = ?', [req.params.id]);
    res.json(rule);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/fee-rules/:id
router.delete('/:id', async (req, res) => {
  try {
    db.update('DELETE FROM fee_rules WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
