const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { calcTotalCost } = require('../utils/calcCost');

router.post('/', async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const created = [];
  const skipped = [];

  for (const it of items) {
    // 去重：检查 notes 中是否已有 renrigou_item_id
    const match = (it.notes || '').match(/renrigou_item_id:(\d+)/);
    if (match) {
      const existing = await db.get(
        "SELECT id FROM toys WHERE notes LIKE ? LIMIT 1",
        ['%renrigou_item_id:' + match[1] + '%']
      );
      if (existing) {
        skipped.push({ title: it.name, existingId: existing.id, itemId: match[1] });
        continue;
      }
    }

    const totalCost = calcTotalCost(it);

    const cols = [
      'name','category','source','status','supplier_id','supplier_name','purchase_date',
      'japan_price_jpy','japan_price_cny','japan_price_includes_tax','japan_consumption_tax',
      'handling_fee','japan_domestic_shipping',
      'proxy_price','proxy_intl_shipping','proxy_domestic_shipping',
      'domestic_price','domestic_shipping',
      'intl_shipping','import_duty',
      'logistics_type','logistics_fee','logistics_tracking','logistics_weight','logistics_region',
      'box_size','box_fee','packing_fee',
      'sell_price','sell_date','huabei','refund_amount',
      'procurement_stage',
      'stage1_date','stage1_amount','stage1_note','stage1_jpy','stage1_handling','stage1_domestic_ship',
      'stage2_date','stage2_amount','stage2_note','stage2_handling','stage2_domestic_ship',
      'stage3_date','stage3_amount','stage3_note','stage3_intl_ship','stage3_tax','stage3_tax_mode',
      'expected_arrival_date',
      'shipment_id','total_cost','profit','baltan_ref_id','notes'
    ];

    const vals = cols.map(c => {
      if (c === 'total_cost') return totalCost;
      if (c === 'profit') return null;
      if (c === 'supplier_id') return null;
      if (c === 'stage3_tax_mode') return it.stage3_tax_mode || 'normal';
      return it[c] ?? null;
    });

    const sql = 'INSERT INTO toys (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')';
    const id = await db.insert(sql, vals);
    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [id]);
    created.push(toy);
  }

  res.json({ created, skipped, total: items.length, createdCount: created.length, skippedCount: skipped.length });
});

module.exports = router;
