const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/products — 列表，含汇总数据
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    const where = [];
    const params = [];
    if (category) { where.push('p.category = ?'); params.push(category); }
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      where.push('(LOWER(p.name) LIKE ? OR LOWER(p.name_zh) LIKE ?)');
      params.push(q, q);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const sql = `SELECT p.* FROM products p ${whereClause} ORDER BY p.created_at DESC`;
    const products = await db.all(sql, params);

    // 对每个 product 算汇总
    const enriched = [];
    for (const p of products) {
      // 总成本 + 总数量 + 剩余 (from toys)
      const batchStats = await db.get(
        `SELECT COALESCE(SUM(total_cost),0) as total_cost,
                COALESCE(SUM(quantity),0) as total_qty,
                COALESCE(SUM(remaining),0) as total_remaining
         FROM toys WHERE product_id = ? AND status = 'stock'`,
        [p.id]
      );
      // 总销售收入
      const salesStats = await db.get(
        `SELECT COALESCE(SUM(total_revenue),0) as total_revenue,
                COALESCE(SUM(quantity),0) as sold_qty
         FROM sales WHERE product_id = ?`,
        [p.id]
      );
      const totalCost = batchStats.total_cost || 0;
      const totalQty = batchStats.total_qty || 0;
      const totalRemaining = batchStats.total_remaining || 0;
      const totalRevenue = salesStats.total_revenue || 0;
      const soldQty = salesStats.sold_qty || 0;

      enriched.push({
        ...p,
        total_cost: totalCost,
        total_qty: totalQty,
        total_remaining: totalRemaining,
        sold_qty: soldQty,
        avg_unit_cost: totalQty > 0 ? totalCost / totalQty : 0,
        total_revenue: totalRevenue,
        breakeven: totalCost > 0 ? (totalRevenue / totalCost >= 1 ? '回本' : '未回本') : '无成本',
        breakeven_rate: totalCost > 0 ? ((totalRevenue / totalCost) * 100) : 0,
        // 库存待覆盖成本 = 剩余成本(总成本-已回收)
        unrecovered_cost: Math.max(0, totalCost - totalRevenue),
        inventory_value_at_cost: totalRemaining > 0 && totalQty > 0 ? (totalCost / totalQty) * totalRemaining : 0,
      });
    }

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Not found' });

    // 该 product 下的所有库存批次
    const batches = await db.all(
      `SELECT id, name, name_zh, total_cost, quantity, remaining, unit_cost,
              purchase_date, source, supplier_name, created_at
       FROM toys WHERE product_id = ? AND status = 'stock' AND remaining > 0
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    // 所有卖出的批次（含零库存）
    const soldBatches = await db.all(
      `SELECT id, name, name_zh, total_cost, quantity, remaining, unit_cost,
              purchase_date, source, created_at
       FROM toys WHERE product_id = ? AND remaining = 0
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    // 销售记录汇总
    const salesStats = await db.get(
      `SELECT COALESCE(SUM(total_revenue),0) as total_revenue,
              COALESCE(SUM(quantity),0) as sold_qty
       FROM sales WHERE product_id = ?`,
      [req.params.id]
    );

    const allBatches = [...batches, ...soldBatches];
    const totalCost = allBatches.reduce((s, b) => s + (b.total_cost || 0), 0);
    const totalQty = allBatches.reduce((s, b) => s + (b.quantity || 0), 0);
    const totalRemaining = batches.reduce((s, b) => s + (b.remaining || 0), 0);

    res.json({
      ...product,
      batches,
      sold_batches: soldBatches,
      total_cost: totalCost,
      total_qty: totalQty,
      total_remaining: totalRemaining,
      avg_unit_cost: totalQty > 0 ? totalCost / totalQty : 0,
      total_revenue: salesStats?.total_revenue || 0,
      sold_qty: salesStats?.sold_qty || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const t = req.body;
    const cols = ['name', 'name_zh', 'category', 'source', 'image', 'notes'];
    const vals = [
      t.name || '',
      t.name_zh || '',
      t.category || '其他',
      t.source || 'direct',
      t.image || null,
      t.notes || null,
    ];
    const sql = `INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    const id = await db.insert(sql, vals);
    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const t = req.body;
    const merged = { ...existing, ...t };
    const skip = ['id', 'created_at'];
    const cols = Object.keys(merged).filter(k => !skip.includes(k));

    const sql = `UPDATE products SET ${cols.map(c => c + ' = ?').join(',')} WHERE id = ?`;
    const vals = [...cols.map(c => merged[c] ?? null), req.params.id];
    db.update(sql, vals);

    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    // 检查是否有关联的 toys
    const count = (await db.get('SELECT COUNT(*) as c FROM toys WHERE product_id = ?', [req.params.id]))?.c || 0;
    if (count > 0) {
      return res.status(400).json({ error: `该商品下还有 ${count} 条进货记录，无法删除` });
    }
    db.update('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
