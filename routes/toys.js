const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { enrichToy, calcBaseFromTarget, calcTotalCost } = require('../utils/calcCost');
const { fetchAndSaveImage } = require('../utils/downloadImage');
const path = require('path');
const fs = require('fs');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * 一致性保险：category 不在 categories 表里就自动补登顶级分类。
 * 防止 toys/products 写新 category 但分类表里没登记。
 */
async function ensureCategoryExists(name) {
  if (!name || typeof name !== 'string') return;
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    const exist = await db.get('SELECT id FROM categories WHERE name = ?', [trimmed]);
    if (exist) return;
    await db.insert(
      'INSERT INTO categories (name, color, parent_id) VALUES (?, ?, ?)',
      [trimmed, '#6b7085', null]
    );
    console.log('[ensureCategory] 自动补登分类:', trimmed);
  } catch (e) {
    console.warn('[ensureCategory] 补登失败（已忽略）:', trimmed, e.message);
  }
}

/**
 * 池封面自动补齐：若 product.image 为空，取该池下最早入池的有图 toy 的 image 当封面。
 * 幂等：已有封面不动；该池下当前没有任何 toy 有图也不动（保持空等以后）。
 * 排序键：COALESCE(purchase_date, created_at) ASC, id ASC（先 purchase_date 没就用 created_at）
 */
async function backfillPoolCover(productId) {
  if (!productId) return;
  try {
    const product = await db.get('SELECT image FROM products WHERE id = ?', [productId]);
    if (!product || product.image) return; // 已有封面或池不存在 → 不动
    const earliest = await db.get(
      `SELECT image FROM toys
       WHERE product_id = ? AND image IS NOT NULL AND image != ''
       ORDER BY COALESCE(purchase_date, created_at) ASC, id ASC
       LIMIT 1`,
      [productId]
    );
    if (earliest && earliest.image) {
      db.update('UPDATE products SET image = ? WHERE id = ?', [earliest.image, productId]);
      console.log('[backfillPoolCover] 池', productId, '封面 ← ', earliest.image);
    }
  } catch (e) {
    console.warn('[backfillPoolCover] 失败（已忽略）:', productId, e.message);
  }
}

/**
 * 全量回填：扫所有 product 把封面补齐。一次性数据迁移用。
 * 返回 { scanned, filled, skipped } 报告。
 */
async function backfillAllPoolCovers() {
  const products = await db.all("SELECT id, name FROM products WHERE image IS NULL OR image = ''");
  let filled = 0;
  for (const p of products) {
    const before = await db.get('SELECT image FROM products WHERE id = ?', [p.id]);
    if (before && before.image) continue; // 已被并发补上了
    await backfillPoolCover(p.id);
    const after = await db.get('SELECT image FROM products WHERE id = ?', [p.id]);
    if (after && after.image) filled++;
  }
  return { scanned: products.length, filled, skipped: products.length - filled };
}

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
      where.push('(LOWER(name) LIKE ? OR LOWER(name_zh) LIKE ? OR LOWER(category) LIKE ?)');
      params.push(q, q, q);
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

// POST /api/toys/pool-logs — 写入池操作日志
router.post('/pool-logs', async (req, res) => {
  try {
    const { product_id, toy_id, action, toy_name, quantity, unit_cost, total_cost, notes } = req.body || {};
    if (!action || !product_id) {
      return res.status(400).json({ error: 'product_id and action are required' });
    }
    const id = await db.insert(
      `INSERT INTO pool_logs (product_id, toy_id, action, toy_name, quantity, unit_cost, total_cost, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_id, toy_id || null, action, toy_name || '', quantity || null, unit_cost || null, total_cost || null, notes || null]
    );
    const log = await db.get('SELECT * FROM pool_logs WHERE id = ?', [id]);
    res.json(log);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/toys/pool-logs — 查询池操作日志
router.get('/pool-logs', async (req, res) => {
  try {
    const { product_id } = req.query;
    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }
    const logs = await db.all(
      'SELECT * FROM pool_logs WHERE product_id = ? ORDER BY created_at DESC',
      [Number(product_id)]
    );
    res.json(logs);
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
    // 一致性保险：category 补登
    if (t.category) await ensureCategoryExists(t.category);
    // 合并阶段金额到总成本 (与 calcTotalCost 同源)
    const totalCost = calcTotalCost(t);

    const cols = [
      'name','name_zh','category','source','status','supplier_id','supplier_name','purchase_date',
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
      'shipment_id','total_cost','profit','baltan_ref_id','notes','image',
      'product_id','quantity','remaining','unit_cost',
      // 物流费对账（拿到真实账单后填实际值；差异 = 实际 - 预估）
      'japan_domestic_shipping_actual','proxy_intl_shipping_actual','proxy_domestic_shipping_actual',
      'domestic_shipping_actual','intl_shipping_actual','logistics_fee_actual',
      'stage1_handling_actual','stage1_domestic_ship_actual','stage2_handling_actual',
      'stage2_domestic_ship_actual','stage3_intl_ship_actual'
    ];

    const vals = cols.map(c => {
      if (c === 'total_cost') return totalCost;
      if (c === 'profit') return null;
      if (c === 'supplier_id' && !t.supplier_id) return null;
      if (c === 'stage3_tax_mode') return t.stage3_tax_mode || 'normal';
      if (c === 'quantity') return t.quantity != null ? Number(t.quantity) : (t.product_id ? 1 : null);
      if (c === 'product_id') return t.product_id ? Number(t.product_id) : null;
      if (c === 'remaining') return t.remaining != null ? Number(t.remaining) : (t.quantity != null ? Number(t.quantity) : null);
      if (c === 'unit_cost') return t.unit_cost != null ? Number(t.unit_cost) : null;
      return t[c] ?? null;
    });

    const sql = `INSERT INTO toys (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    const id = await db.insert(sql, vals);
    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [id]);
    // 新 toy 入池时，尝试补齐 product 封面
    if (toy.product_id) await backfillPoolCover(toy.product_id);
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
    // 一致性保险：category 改了补登
    if (t.category !== undefined && t.category !== existing.category) {
      await ensureCategoryExists(t.category);
    }
    const merged = { ...existing, ...t };

    // 如果请求体明确传了 total_cost（如入池分摊），尊重前端计算值
    // 否则用 calcTotalCost 重新计算
    if ('total_cost' in t && t.total_cost !== undefined) {
      merged.total_cost = Number(t.total_cost);
    } else {
      merged.total_cost = calcTotalCost(merged);
    }
    merged.profit = null; // recalculated by enrichToy

    const skip = ['id', 'created_at'];
    const cols = Object.keys(merged).filter(k => !skip.includes(k));

    const sql = `UPDATE toys SET ${cols.map(c => c + ' = ?').join(',')} WHERE id = ?`;
    const vals = [...cols.map(c => merged[c] ?? null), req.params.id];

    db.update(sql, vals);
    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [req.params.id]);
    // 玩具更新后，若归属到某 product，尝试补齐该池封面
    if (toy.product_id) await backfillPoolCover(toy.product_id);
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

// POST /api/toys/batch-delete
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const placeholders = ids.map(() => '?').join(',');
    db.update('DELETE FROM toys WHERE id IN (' + placeholders + ')', ids);
    res.json({ ok: true, deleted: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/toys/batch-stockin
router.post('/batch-stockin', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    // 逐条处理，池模式下自动算 unit_cost + remaining
    for (const id of ids) {
      const toy = await db.get('SELECT * FROM toys WHERE id = ?', [id]);
      if (!toy) continue;

      const totalCost = calcTotalCost(toy);
      const productId = toy.product_id;
      const qty = toy.quantity;

      if (productId && qty && qty > 0) {
        const unitCost = totalCost / qty;
        db.update(
          `UPDATE toys SET status = 'stock', procurement_stage = 'stocked',
           total_cost = ?, unit_cost = ?, remaining = ? WHERE id = ?`,
          [totalCost, unitCost, qty, id]
        );
      } else {
        db.update(
          `UPDATE toys SET status = 'stock', procurement_stage = 'stocked', total_cost = ? WHERE id = ?`,
          [totalCost, id]
        );
      }
      // 刚入库到某池 → 尝试补齐该池封面
      if (productId) await backfillPoolCover(productId);
    }
    res.json({ ok: true, stocked: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/toys/backfill-pool-covers — 一次性扫所有 product 把封面补齐
router.post('/backfill-pool-covers', async (req, res) => {
  try {
    const result = await backfillAllPoolCovers();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/toys/:id/image-from-url — 粘贴远程 URL，后端下载到 uploads/ 并写 toys.image
router.post('/:id/image-from-url', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url required' });
    const toy = await db.get('SELECT id, name, product_id FROM toys WHERE id = ?', [req.params.id]);
    if (!toy) return res.status(404).json({ error: 'toy not found' });
    // 用 toy.id 作为 itemId，文件名 renrigou_{id}.ext（与 import 保持一致便于管理）
    const result = await fetchAndSaveImage(url, `manual_${toy.id}_${Date.now()}`);
    if (!result.ok) return res.status(500).json({ error: '下载失败：' + result.reason, attempts: result.attempts });
    db.update('UPDATE toys SET image = ?, image_fetched_at = ? WHERE id = ?',
      [result.localPath, new Date().toISOString(), toy.id]);
    // 入池商品同时回填池封面（幂等）
    if (toy.product_id) await backfillPoolCover(toy.product_id);
    res.json({ ok: true, image: result.localPath, attempts: result.attempts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/toys/:id/image-base64 — 前端 FileReader 读本机图片 → base64 → 写 uploads/
// body: { data: 'data:image/jpeg;base64,...', filename?: 'xxx.jpg' }
router.post('/:id/image-base64', async (req, res) => {
  try {
    const { data, filename } = req.body || {};
    if (!data || !data.startsWith('data:')) return res.status(400).json({ error: 'data 必须是 data: URL' });
    const toy = await db.get('SELECT id, product_id FROM toys WHERE id = ?', [req.params.id]);
    if (!toy) return res.status(404).json({ error: 'toy not found' });

    // 解析 base64
    const m = data.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'data 格式错误' });
    const mime = m[1];
    const buf = Buffer.from(m[2], 'base64');
    const ext = mime.includes('png') ? '.png'
              : mime.includes('webp') ? '.webp'
              : mime.includes('gif') ? '.gif'
              : '.jpg';

    // 落到 uploads/toy_manual_{id}_{ts}{ext}（不复用 renrigou_ 前缀，避免与抓取图片混淆）
    const safeName = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-40) : '';
    const fname = `toy_manual_${toy.id}_${Date.now()}${safeName ? '_' + safeName : ''}${ext}`;
    const dest = path.join(UPLOADS_DIR, fname);
    fs.writeFileSync(dest, buf);
    const localPath = '/uploads/' + fname;

    db.update('UPDATE toys SET image = ?, image_fetched_at = ? WHERE id = ?',
      [localPath, new Date().toISOString(), toy.id]);
    if (toy.product_id) await backfillPoolCover(toy.product_id);

    res.json({ ok: true, image: localPath, size: buf.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
