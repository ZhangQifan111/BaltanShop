const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', async (req, res) => {
  try {
    const rules = await db.all('SELECT * FROM shipping_rules ORDER BY id');
    res.json(rules);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/calculate', async (req, res) => {
  try {
    const { province, weight } = req.query;
    if (!province || !weight) return res.json({ fee: 0 });
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return res.json({ fee: 0 });
    // 用首尾加逗号避免 "山" 匹中 "山东,山西"
    const rule = await db.get(
      `SELECT * FROM shipping_rules WHERE ',' || IFNULL(provinces, '') || ',' LIKE ? LIMIT 1`,
      [`%,${province},%`]
    );
    if (!rule) return res.json({ fee: 0 });
    let fee = Number(rule.first_fee) || 0;
    const fw = Number(rule.first_weight) || 0;
    const aw = Number(rule.additional_weight) || 1;
    const af = Number(rule.additional_fee) || 0;
    if (w > fw) {
      const steps = Math.ceil((w - fw) / aw);
      fee += steps * af;
    }
    res.json({ fee: Math.round(fee * 100) / 100 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, carrier, provinces, first_weight, first_fee, additional_weight, additional_fee, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = await db.insert(
      `INSERT INTO shipping_rules (name, carrier, provinces, first_weight, first_fee, additional_weight, additional_fee, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, carrier || 'zto', provinces || null, first_weight || 1, first_fee || 0, additional_weight || 1, additional_fee || 0, notes || null]
    );
    const rule = await db.get('SELECT * FROM shipping_rules WHERE id = ?', [id]);
    res.json(rule);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, carrier, provinces, first_weight, first_fee, additional_weight, additional_fee, notes } = req.body;
    db.update(
      `UPDATE shipping_rules SET name=?, carrier=?, provinces=?, first_weight=?, first_fee=?, additional_weight=?, additional_fee=?, notes=? WHERE id=?`,
      [name, carrier, provinces, first_weight, first_fee, additional_weight, additional_fee, notes, req.params.id]
    );
    const rule = await db.get('SELECT * FROM shipping_rules WHERE id = ?', [req.params.id]);
    res.json(rule);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    db.update('DELETE FROM shipping_rules WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
