const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { calcTotalCost } = require('../utils/calcCost');

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
    // 注意：用 calcTotalCost 重算每个 toy 的成本再 SUM，
    //       防御 DB 里 toys.total_cost 字段是旧脏数据（早期写入未走 calcTotalCost）导致聚合失真
    const enriched = [];
    for (const p of products) {
      // 拉所有池内玩具（含 status='stock' 用于库存汇总、status='sold'/'done' 用于已售出汇总）
      const allToys = await db.all(
        `SELECT * FROM toys WHERE product_id = ?`,
        [p.id]
      );
      // 用 calcTotalCost 重算每条成本（替代直接读 toys.total_cost 字段）
      let totalCost = 0;          // 全部批次（含已售出）成本合计
      let totalRemainingCost = 0; // 仅剩余库存加权成本
      let totalQty = 0;
      let totalRemaining = 0;
      let stockBatchCount = 0;
      for (const t of allToys) {
        const cost = calcTotalCost(t);
        totalCost += cost;
        totalQty += (t.quantity || 0);
        if (t.status === 'stock') {
          totalRemaining += (t.remaining != null ? t.remaining : (t.quantity || 0));
          totalRemainingCost += cost * (t.remaining != null ? t.remaining : (t.quantity || 0));
          stockBatchCount++;
        }
      }

      // 总销售收入
      const salesStats = await db.get(
        `SELECT COALESCE(SUM(total_revenue),0) as total_revenue,
                COALESCE(SUM(quantity),0) as sold_qty
         FROM sales WHERE product_id = ?`,
        [p.id]
      );
      const totalRevenue = salesStats.total_revenue || 0;
      const soldQty = salesStats.sold_qty || 0;
      // 按实际库存加权均价（精确到分）
      const avgUnitCost = totalRemaining > 0
        ? Math.round((totalRemainingCost / totalRemaining) * 100) / 100
        : 0;

      enriched.push({
        ...p,
        total_cost: Math.round(totalCost * 100) / 100,
        total_qty: totalQty,
        total_remaining: totalRemaining,
        batch_count: stockBatchCount,
        sold_qty: soldQty,
        avg_unit_cost: avgUnitCost,
        total_revenue: totalRevenue,
        breakeven: totalCost > 0 ? (totalRevenue / totalCost >= 1 ? '回本' : '未回本') : '无成本',
        breakeven_rate: totalCost > 0 ? ((totalRevenue / totalCost) * 100) : 0,
        // 库存待覆盖成本 = 总成本 - 已回收收入（最低 0）
        unrecovered_cost: Math.max(0, Math.round((totalCost - totalRevenue) * 100) / 100),
        inventory_value_at_cost: Math.round(totalRemainingCost * 100) / 100,
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
    // 同样用 calcTotalCost 重算，避免 toys.total_cost 脏数据导致聚合失真
    const totalCost = allBatches.reduce((s, b) => s + calcTotalCost(b), 0);
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
    // 解除所有关联 toys 的池绑定
    db.update('UPDATE toys SET product_id = NULL, quantity = NULL, remaining = NULL, unit_cost = NULL WHERE product_id = ?', [req.params.id]);
    db.update('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
