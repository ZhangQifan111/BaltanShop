const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { calcTotalCost } = require('../utils/calcCost');
const { fetchAndSaveImage, runWithConcurrency, decodeRngImg } = require('../utils/downloadImage');
const { ensureCategoryExists } = require('./toys');

router.post('/', async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const created = [];
  const skipped = [];
  let imagesOk = 0, imagesFail = 0;

  // 1) 先处理已存在的（顺序处理，避免和并发写冲突）
  const toCreate = [];
  for (const it of items) {
    const match = (it.notes || '').match(/renrigou_item_id:(\d+)/);
    if (match) {
      const existing = await db.get(
        "SELECT id FROM toys WHERE notes LIKE ? LIMIT 1",
        ['%renrigou_item_id:' + match[1] + '%']
      );
      if (existing) {
        let imageFixed = false;
        if (it.image_url) {
          const result = await fetchAndSaveImage(it.image_url, it.item_id || match[1]);
          if (result.ok) {
            db.update('UPDATE toys SET image = ?, image_url = ?, image_fetched_at = ? WHERE id = ?',
              [result.localPath, it.image_url, new Date().toISOString(), existing.id]);
            imageFixed = true;
            imagesOk++;
          } else {
            db.update('UPDATE toys SET image = ?, image_url = ? WHERE id = ?',
              [null, it.image_url, existing.id]);
            imagesFail++;
          }
        }
        skipped.push({ title: it.name, existingId: existing.id, itemId: match[1], imageFixed });
        continue;
      }
    }
    toCreate.push(it);
  }

  // 2) 并发下载新商品的图片
  const enriched = await runWithConcurrency(toCreate, 5, async (it) => {
    if (!it.image_url) return { it, dl: { ok: false, reason: 'no_url', attempts: 0 } };
    return { it, dl: await fetchAndSaveImage(it.image_url, it.item_id || 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2,7)) };
  });

  // 3) 顺序入库（sql.js 单文件锁，串行写）
  for (const { it, dl } of enriched) {
    const totalCost = calcTotalCost(it);
    // 任你购导入：根据 it.category 字符串查/建 categories 表取 id
    let categoryId = null;
    if (it.category) {
      await ensureCategoryExists(it.category);
      const cat = await db.get('SELECT id FROM categories WHERE name = ?', [it.category.trim()]);
      if (cat) categoryId = cat.id;
    }
    const cols = [
      'name','name_zh','category','category_id','source','status','supplier_id','supplier_name','purchase_date',
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
      'shipment_id','total_cost','profit','baltan_ref_id','notes','image','image_url','image_fetched_at'
    ];

    const now = new Date().toISOString();
    const vals = cols.map(c => {
      if (c === 'total_cost') return totalCost;
      if (c === 'profit') return null;
      if (c === 'supplier_id') return null;
      if (c === 'stage3_tax_mode') return it.stage3_tax_mode || 'normal';
      if (c === 'image') return dl.ok ? dl.localPath : null;
      if (c === 'image_url') return it.image_url || null;
      if (c === 'image_fetched_at') return dl.ok ? now : null;
      if (c === 'category_id') return categoryId;
      return it[c] ?? null;
    });

    const sql = 'INSERT INTO toys (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')';
    const id = await db.insert(sql, vals);

    if (dl.ok) imagesOk++; else if (it.image_url) imagesFail++;

    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [id]);
    created.push(toy);
  }

  res.json({
    created, skipped,
    total: items.length,
    createdCount: created.length,
    skippedCount: skipped.length,
    images: { ok: imagesOk, fail: imagesFail }
  });
});

// 预检：哪些 item_id 已存在（dry-run，不入库）
router.post('/check', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : null;
    if (!items && !itemIds) return res.status(400).json({ error: 'items 或 itemIds 必填' });

    const existing = [];
    const seen = new Set();

    async function checkOne(it) {
      let id = null;
      const m = (it.notes || '').match(/renrigou_item_id:(\d+)/);
      if (m) id = m[1];
      if (!id && it.item_id) id = String(it.item_id);
      if (!id && typeof it === 'string') id = it;
      if (!id) return null;
      if (seen.has(id)) return null;
      seen.add(id);

      const row = await db.get(
        "SELECT id, name FROM toys WHERE notes LIKE ? LIMIT 1",
        ['%renrigou_item_id:' + id + '%']
      );
      if (row) return { itemId: id, existingId: row.id, title: row.name };
      return { itemId: id };
    }

    const sourceList = items || itemIds.map(id => ({ item_id: id }));
    for (const it of sourceList) {
      const r = await checkOne(it);
      if (r) existing.push(r);
    }

    res.json({
      existing: existing.filter(e => e.existingId),
      missing: existing.filter(e => !e.existingId).map(e => e.itemId)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
