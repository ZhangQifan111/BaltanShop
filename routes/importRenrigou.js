const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db/database');
const { calcTotalCost } = require('../utils/calcCost');

function decodeRngImg(url) {
  try {
    const m = (url || '').match(/rl\.rng\.vip\/([A-Za-z0-9+/=]+)/);
    if (!m) return null;
    return Buffer.from(m[1], 'base64').toString('utf8');
  } catch { return null; }
}

function downloadImage(imgUrl, destPath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    const url = new URL(imgUrl);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://rl.rngmoe.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      timeout: 15000
    };
    https.get(opts, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(destPath, () => {}); return resolve(false); }
      res.pipe(file);
      file.on('finish', () => resolve(true));
      file.on('error', () => { fs.unlink(destPath, () => {}); resolve(false); });
    }).on('error', () => { fs.unlink(destPath, () => {}); resolve(false); });
  });
}

async function fetchAndSaveImage(imageUrl, itemId) {
  // 直接用 renrigou 代理 URL 下载，不解码到 Yahoo（浏览器也是这么加载的）
  const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[0] || '.jpg';
  const fname = 'renrigou_' + itemId + ext;
  const dest = path.join(__dirname, '..', 'uploads', fname);
  if (fs.existsSync(dest)) return '/uploads/' + fname;
  const ok = await downloadImage(imageUrl, dest);
  return ok ? '/uploads/' + fname : null;
}

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
      'shipment_id','total_cost','profit','baltan_ref_id','notes','image'
    ];

    const vals = cols.map(c => {
      if (c === 'total_cost') return totalCost;
      if (c === 'profit') return null;
      if (c === 'supplier_id') return null;
      if (c === 'stage3_tax_mode') return it.stage3_tax_mode || 'normal';
      if (c === 'image') return null;
      return it[c] ?? null;
    });

    const sql = 'INSERT INTO toys (' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')';
    const id = await db.insert(sql, vals);

    // 下载图片到本地，避免远程链接过期
    if (it.image_url) {
      try {
        const localPath = await fetchAndSaveImage(it.image_url, it.item_id || id);
        if (localPath) {
          db.update('UPDATE toys SET image = ? WHERE id = ?', [localPath, id]);
        } else {
          // 下载失败时保留远程链接作为后备
          db.update('UPDATE toys SET image = ? WHERE id = ?', [it.image_url, id]);
        }
      } catch (e) {
        db.update('UPDATE toys SET image = ? WHERE id = ?', [it.image_url, id]);
      }
    }

    const toy = await db.get('SELECT * FROM toys WHERE id = ?', [id]);
    created.push(toy);
  }

  res.json({ created, skipped, total: items.length, createdCount: created.length, skippedCount: skipped.length });
});

// 预检：哪些 item_id 已存在（dry-run，不入库）
// 入参 { items: [...] } 或 { itemIds: [...] }；返回 { existing: [{ itemId, existingId, title }], missing: [...] }
router.post('/check', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : null;
    if (!items && !itemIds) return res.status(400).json({ error: 'items 或 itemIds 必填' });

    const existing = [];
    const seen = new Set();

    async function checkOne(it) {
      // 从 notes 提取
      let id = null;
      const m = (it.notes || '').match(/renrigou_item_id:(\d+)/);
      if (m) id = m[1];
      // 或者直接给 itemId
      if (!id && it.item_id) id = String(it.item_id);
      // 或者顶层传 itemIds
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
      existing: existing.filter(e => e.existingId),  // 已存在的
      missing: existing.filter(e => !e.existingId).map(e => e.itemId)  // 未存在的 itemId
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
