const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { refreshDatabase } = require('../utils/scrapeBaltan');
const { downloadAll, UPLOAD_DIR } = require('../utils/downloadBaltan');

async function ensureSeeded() {
  const row = await db.get('SELECT COUNT(*) as c FROM baltan_reference');
  if (row.c === 0) {
    await refreshDatabase(db);
  }
}

function getOwnedToys(refId) {
  // 模糊匹配：名字包含バルタン / 巴坦 / Baltan / baltan 之一
  return db.all(
    `SELECT id, name, category, source, status, total_cost, profit, sell_price, sell_date, purchase_date
     FROM toys
     WHERE LOWER(name) LIKE '%バルタン%'
        OR LOWER(name) LIKE '%巴坦%'
        OR LOWER(name) LIKE '%baltan%'`
  );
}

router.get('/reference', async (req, res) => {
  try {
    await ensureSeeded();
    const refs = await db.all('SELECT * FROM baltan_reference ORDER BY generation, position, ref_id');
    // 1) 精确匹配: baltan_ref_id = "{generation}-{ref_id}"
    const ownedByRef = new Map(); // key: "1-01" -> [toys]
    // 2) 名字模糊匹配: name 含 バルタン/巴坦/Baltan
    const nameMatched = await db.all(
      `SELECT * FROM toys
       WHERE baltan_ref_id IS NULL
         AND (LOWER(name) LIKE '%バルタン%'
              OR LOWER(name) LIKE '%巴坦%'
              OR LOWER(name) LIKE '%baltan%')`
    );
    // 3) 精确绑定: baltan_ref_id 有值的
    const exactMatched = await db.all(
      `SELECT * FROM toys WHERE baltan_ref_id IS NOT NULL`
    );
    for (const t of exactMatched) {
      const key = t.baltan_ref_id;
      if (!ownedByRef.has(key)) ownedByRef.set(key, []);
      ownedByRef.get(key).push(t);
    }
    // 名字模糊的全部加到 owned_count 统计，但只展示在 matched 列表里
    const items = refs.map(r => {
      const exactKey = `${r.generation}-${r.ref_id}`;
      const exact = ownedByRef.get(exactKey) || [];
      return {
        id: r.id,
        ref_id: r.ref_id,
        generation: r.generation,
        source: r.source,
        detail_url: r.detail_url,
        image_url: r.image_url,
        image_big_url: r.image_big_url,
        owned: exact,
        fuzzy_count: exact.length === 0 ? nameMatched.length : 0
      };
    });
    res.json({ items, owned_count: exactMatched.length, fuzzy_count: nameMatched.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const count = await refreshDatabase(db);
    res.json({ ok: true, count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 一次性下载所有图片到本地 + 更新 image_url 指向本地
router.post('/download-images', async (req, res) => {
  try {
    const refs = await db.all('SELECT * FROM baltan_reference ORDER BY generation, position, ref_id');
    const results = await downloadAll(refs, 4);
    // 更新 DB：image_url / image_big_url 改为本地路径
    let updated = 0;
    for (const r of results) {
      if (r.thumb) {
        const localUrl = `/uploads/baltan/${r.slug}.png`;
        db.update('UPDATE baltan_reference SET image_url=? WHERE id=(SELECT id FROM baltan_reference WHERE generation=? AND ref_id=?)',
          [localUrl, parseInt(r.slug.split('-')[0]), r.slug.split('-')[1]]);
        updated += 1;
      }
      if (r.big) {
        const localBigUrl = `/uploads/baltan/${r.slug}-big.png`;
        db.update('UPDATE baltan_reference SET image_big_url=? WHERE id=(SELECT id FROM baltan_reference WHERE generation=? AND ref_id=?)',
          [localBigUrl, parseInt(r.slug.split('-')[0]), r.slug.split('-')[1]]);
      }
    }
    const total = results.reduce((s, r) => s + (r.thumb?.size || 0) + (r.big?.size || 0), 0);
    const skipped = results.filter(r => r.thumb?.skipped).length;
    const errors = results.filter(r => r.errors.length).map(r => ({ slug: r.slug, errors: r.errors }));
    res.json({
      ok: true,
      count: results.length,
      updated,
      skipped,
      total_bytes: total,
      upload_dir: UPLOAD_DIR,
      errors
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
