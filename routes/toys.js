const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { enrichToy, calcBaseFromTarget, calcTotalCost } = require('../utils/calcCost');

// GET /api/toys
router.get('/', async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (category) { where.push('category = ?'); params.push(category); }
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      where.push('(LOWER(name) LIKE ? OR LOWER(category) LIKE ?)');
      params.push(q, q);
    }
    const sql = `SELECT * FROM toys${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    const toys = (await db.all(sql, params)).map(enrichToy);
    res.json(toys);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/toys/estimate
// 反算进货基准价：已知 sell_price + 目标利润 + 各项费用 → 推荐 base
// 费用模型与 calcTotalCost 同步，勿漂移
router.post('/estimate', async (req, res) => {
  try {
    const body = req.body || {};
    const source = body.source;
    if (!['direct', 'proxy', 'domestic', 'secondhand'].includes(source)) {
      return res.status(400).json({ error: 'source must be one of direct/proxy/domestic/secondhand' });
    }
    const sellPrice = Number(body.sell_price);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
      return res.status(400).json({ error: 'sell_price must be a positive number' });
    }

    const hasRate = body.profit_rate !== undefined && body.profit_rate !== null && body.profit_rate !== '';
    const hasAmount = body.profit_amount !== undefined && body.profit_amount !== null && body.profit_amount !== '';
    if (hasRate && hasAmount) {
      return res.status(400).json({ error: 'specify only one of profit_rate or profit_amount' });
    }
    if (!hasRate && !hasAmount) {
      return res.status(400).json({ error: 'must specify profit_rate or profit_amount' });
    }
    let targetProfit;
    if (hasAmount) {
      targetProfit = Number(body.profit_amount);
      if (!Number.isFinite(targetProfit) || targetProfit < 0) {
        return res.status(400).json({ error: 'profit_amount must be >= 0' });
      }
    } else {
      const rate = Number(body.profit_rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
        return res.status(400).json({ error: 'profit_rate must be in [0, 1]' });
      }
      targetProfit = sellPrice * rate;
    }

    const result = calcBaseFromTarget({
      source: source,
      sell_price: sellPrice,
      target_profit: targetProfit,
      refund_amount: body.refund_amount,
      huabei: body.huabei,
      handling_fee: body.handling_fee,
      japan_domestic_shipping: body.japan_domestic_shipping,
      japan_price_includes_tax: body.japan_price_includes_tax,
      intl_shipping: body.intl_shipping,
      logistics_fee: body.logistics_fee,
      box_fee: body.box_fee,
      packing_fee: body.packing_fee
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/toys/:id
router.get('/:id', async (req, res) => {
  try {
    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [req.params.id]);
    if (!toy) return res.status(404).json({ error: 'Not found' });
    res.json(enrichToy(toy));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/toys
router.post('/', async (req, res) => {
  try {
    const t = req.body;
    // 合并阶段金额到总成本 (与 calcTotalCost 同源)
    const totalCost = calcTotalCost(t);

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
      if (c === 'supplier_id' && !t.supplier_id) return null;
      if (c === 'stage3_tax_mode') return t.stage3_tax_mode || 'normal';
      return t[c] ?? null;
    });

    const sql = `INSERT INTO toys (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    const id = await db.insert(sql, vals);
    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [id]);
    res.json(enrichToy(toy));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/toys/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM toys WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const t = req.body;
    const merged = { ...existing, ...t };

    // 重新计算 total_cost (与 calcTotalCost 同源)
    const totalCost = calcTotalCost(merged);
    merged.total_cost = totalCost;
    merged.profit = null; // recalculated by enrichToy

    const skip = ['id', 'created_at'];
    const cols = Object.keys(merged).filter(k => !skip.includes(k));

    const sql = `UPDATE toys SET ${cols.map(c => c + ' = ?').join(',')} WHERE id = ?`;
    const vals = [...cols.map(c => merged[c] ?? null), req.params.id];

    db.update(sql, vals);
    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [req.params.id]);
    res.json(enrichToy(toy));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/toys/:id
router.delete('/:id', async (req, res) => {
  try {
    db.update('DELETE FROM toys WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
