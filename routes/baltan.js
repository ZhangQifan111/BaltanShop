const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { refreshDatabase } = require('../utils/scrapeMonsters');
const { downloadAll, UPLOAD_ROOT } = require('../utils/downloadMonsters');
const { CHARACTER_NAME_ZH } = require('../utils/characterNames');
const path = require('path');
const fs = require('fs');

const ROOT_LOCAL = path.join(__dirname, '..', 'uploads', 'monster');

function withVersion(p) {
  if (!p || p.startsWith('http')) return p;
  const local = path.join(ROOT_LOCAL, p.replace(/^\/uploads\/monster\//, ''));
  try { return p + '?v=' + Math.floor(fs.statSync(local).mtimeMs); } catch { return p; }
}

function localImagePath(ref) {
  if (!ref.character_slug) return null;
  return `/uploads/monster/${ref.character_slug}/${ref.ref_id}.png`;
}
function localBigImagePath(ref) {
  if (!ref.character_slug) return null;
  return `/uploads/monster/${ref.character_slug}/${ref.ref_id}-big.png`;
}

// 把 baltan 限定为只显示 alienbaltan / alienbaltan2 两个角色
router.get('/reference', async (req, res) => {
  try {
    const { series = null, character = null } = req.query;
    const where = [];
    const params = [];
    if (series) { where.push('series = ?'); params.push(series); }
    if (character) { where.push('character_slug = ?'); params.push(character); }
    // 默认行为（无 query）：只显示 baltan 角色，保持 /api/baltan 旧接口语义
    if (!series && !character) {
      where.push("character_slug IN ('alienbaltan','alienbaltan2')");
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const refs = await db.all(`SELECT * FROM baltan_reference ${whereSql} ORDER BY series, character_slug, position, ref_id`, params);

    // 精确绑定（toys.baltan_ref_id 直接命中 ref_id）
    const exactMatched = await db.all(
      `SELECT * FROM toys WHERE baltan_ref_id IS NOT NULL`
    );
    const ownedByRef = new Map();
    for (const t of exactMatched) {
      if (!ownedByRef.has(t.baltan_ref_id)) ownedByRef.set(t.baltan_ref_id, []);
      ownedByRef.get(t.baltan_ref_id).push(t);
    }
    // 模糊匹配（仅在默认 baltan 视图时使用：名字含 バルタン/巴坦/Baltan 且未精确绑定）
    let nameMatched = [];
    if (!series && !character) {
      nameMatched = await db.all(
        `SELECT * FROM toys
         WHERE baltan_ref_id IS NULL
           AND (LOWER(name) LIKE '%バルタン%'
                OR LOWER(name) LIKE '%巴坦%'
                OR LOWER(name) LIKE '%baltan%')`
      );
    }
    const items = refs.map(r => {
      const exact = ownedByRef.get(r.ref_id) || [];
      return {
        id: r.id,
        ref_id: r.ref_id,
        generation: r.generation,
        source: r.source,
        brand: r.brand,
        detail_url: r.detail_url,
        image_url: withVersion(r.image_url),
        image_big_url: withVersion(r.image_big_url),
        series: r.series,
        character_slug: r.character_slug,
        character_name_ja: r.character_name_ja,
        character_name_zh: CHARACTER_NAME_ZH[r.character_slug] || null,
        owned: exact,
        fuzzy_count: exact.length === 0 ? nameMatched.length : 0
      };
    });
    res.json({
      items,
      owned_count: exactMatched.length,
      fuzzy_count: nameMatched.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 兼容旧 /refresh 端点：baltan 模式只刷初代 baltan 角色；新模式按 series 过滤
router.post('/refresh', async (req, res) => {
  try {
    const { series = null } = req.query;
    const result = await refreshDatabase(db, { series, concurrency: 4 });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/download-images', async (req, res) => {
  try {
    const { series = null } = req.query;
    const where = series ? 'WHERE series = ?' : '';
    const params = series ? [series] : [];
    const refs = await db.all(`SELECT * FROM baltan_reference ${where} ORDER BY series, character_slug, ref_id`, params);
    const results = await downloadAll(refs, 8, (done, total) => {
      if (done % 20 === 0 || done === total) console.log(`[download] ${done}/${total}`);
    });
    let updated = 0;
    // 不管 skipped 与否，都 UPDATE 一次 DB 路径（保证 DB 永远指向新本地路径）
    for (const ref of refs) {
      if (!ref.character_slug) continue;
      const thumbUrl = localImagePath(ref);
      const bigUrl = localBigImagePath(ref);
      const wasExternal = (ref.image_url && /^https?:/.test(ref.image_url)) ||
                          (ref.image_big_url && /^https?:/.test(ref.image_big_url));
      const wasOldLocal = (ref.image_url && ref.image_url.startsWith('/uploads/baltan/'));
      if (wasExternal || wasOldLocal) {
        db.update('UPDATE baltan_reference SET image_url=?, image_big_url=? WHERE ref_id=?',
          [thumbUrl, bigUrl, ref.ref_id]);
        updated += 1;
      }
    }
    const total = results.reduce((s, r) => s + (r.thumb?.size || 0) + (r.big?.size || 0), 0);
    const skipped = results.filter(r => r.thumb?.skipped).length;
    const errorList = results.filter(r => r.errors.length).map(r => ({ ref_id: r.ref_id, errors: r.errors }));
    res.json({
      ok: true,
      count: results.length,
      updated,
      skipped,
      total_bytes: total,
      upload_dir: UPLOAD_ROOT,
      errors: errorList
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === 新增 /api/monster/* 端点 ===

// 列出所有 series 及其角色数 / 玩具数
router.get('/series', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT series, COUNT(DISTINCT character_slug) AS characters, COUNT(*) AS toys
       FROM baltan_reference
       WHERE series IS NOT NULL
       GROUP BY series
       ORDER BY MIN(generation), series`
    );
    res.json({ series: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 列出某系列所有角色
router.get('/characters', async (req, res) => {
  try {
    const { series = null } = req.query;
    if (!series) return res.status(400).json({ error: 'series required' });
    const rows = await db.all(
      `SELECT
         character_slug,
         character_name_ja,
         COUNT(*) AS toy_count,
         MIN(image_url) AS thumbnail_url
       FROM baltan_reference
       WHERE series = ?
         AND image_url IS NOT NULL
       GROUP BY character_slug
       ORDER BY MIN(CASE WHEN character_slug = series THEN 0 ELSE 1 END), MIN(position), character_slug`,
      [series]
    );
    for (const r of rows) {
      r.character_name_zh = CHARACTER_NAME_ZH[r.character_slug] || null;
      r.thumbnail_url = withVersion(r.thumbnail_url);
    }
    res.json({ series, characters: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
