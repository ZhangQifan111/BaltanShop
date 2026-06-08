const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const db = require('../db/database');
const { refreshDatabase } = require('../utils/scrapeMonsters');
const { downloadAll, UPLOAD_ROOT } = require('../utils/downloadMonsters');
const { CHARACTER_NAME_ZH } = require('../utils/characterNames');
const path = require('path');
const fs = require('fs');

const ROOT_LOCAL = path.join(__dirname, '..', 'uploads', 'monster');
const DL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

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

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers: { 'User-Agent': DL_UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadOnce(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(fs.statSync(dest).size)));
      file.on('error', reject);
    });
    req.on('error', (e) => { try { fs.unlinkSync(dest); } catch {}; reject(e); });
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

function nextCustomRefId(character_slug) {
  const row = db.getSync(
    `SELECT MAX(CAST(SUBSTR(ref_id, LENGTH(?) + 3) AS INTEGER)) AS max_c
     FROM baltan_reference
     WHERE character_slug = ? AND ref_id LIKE ?`,
    [character_slug, character_slug, `${character_slug}-c%`]
  );
  return `${character_slug}-c${(row?.max_c || 0) + 1}`;
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
        character_name_zh: r.character_name_zh || CHARACTER_NAME_ZH[r.character_slug] || null,
        is_custom: r.is_custom || 0,
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
         MAX(character_name_ja) AS character_name_ja,
         MAX(character_name_zh) AS character_name_zh,
         COUNT(*) AS toy_count,
         MIN(image_url) AS thumbnail_url,
         MAX(is_custom) AS has_custom
       FROM baltan_reference
       WHERE series = ?
       GROUP BY character_slug
       ORDER BY MIN(CASE WHEN character_slug = series THEN 0 ELSE 1 END), MIN(position), character_slug`,
      [series]
    );
    for (const r of rows) {
      r.character_name_zh = r.character_name_zh || CHARACTER_NAME_ZH[r.character_slug] || null;
      r.thumbnail_url = withVersion(r.thumbnail_url);
    }
    res.json({ series, characters: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === 收藏 ===

router.get('/favorites', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM monster_favorites ORDER BY created_at DESC');
    res.json({ favorites: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/favorites', async (req, res) => {
  try {
    const { character_slug, ref_id = '', note = null } = req.body || {};
    if (!character_slug) return res.status(400).json({ error: 'character_slug required' });
    const existing = db.getSync(
      'SELECT 1 FROM monster_favorites WHERE character_slug = ? AND ref_id = ?',
      [character_slug, ref_id]
    );
    if (existing) {
      db.runSync('UPDATE monster_favorites SET note = ? WHERE character_slug = ? AND ref_id = ?',
        [note, character_slug, ref_id]);
    } else {
      db.runSync('INSERT INTO monster_favorites (character_slug, ref_id, note) VALUES (?, ?, ?)',
        [character_slug, ref_id, note]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/favorites', async (req, res) => {
  try {
    const { character_slug, ref_id = '', all } = req.query;
    if (!character_slug) return res.status(400).json({ error: 'character_slug required' });
    if (all === '1' || all === 'true') {
      db.runSync('DELETE FROM monster_favorites WHERE character_slug = ?', [character_slug]);
    } else {
      db.runSync('DELETE FROM monster_favorites WHERE character_slug = ? AND ref_id = ?',
        [character_slug, ref_id]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 取收藏角色的完整卡片信息（用于"收藏"视图）
router.post('/favorites/characters', async (req, res) => {
  try {
    const { slugs = [] } = req.body || {};
    if (!slugs.length) return res.json({ characters: [] });
    const placeholders = slugs.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT
         character_slug,
         MAX(series) AS series,
         MAX(character_name_ja) AS character_name_ja,
         MAX(character_name_zh) AS character_name_zh,
         COUNT(*) AS toy_count,
         MIN(image_url) AS thumbnail_url,
         MAX(is_custom) AS has_custom
       FROM baltan_reference
       WHERE character_slug IN (${placeholders})
       GROUP BY character_slug
       ORDER BY character_slug`,
      slugs
    );
    for (const r of rows) {
      r.character_name_zh = r.character_name_zh || CHARACTER_NAME_ZH[r.character_slug] || null;
      r.thumbnail_url = withVersion(r.thumbnail_url);
    }
    res.json({ characters: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === 自定义玩具 / 角色 ===

// 在已有角色下新增一个第三方玩具
router.post('/custom-toy', async (req, res) => {
  try {
    const { character_slug, series, name, source, brand, image_url, detail_url } = req.body || {};
    if (!character_slug || !name) return res.status(400).json({ error: 'character_slug and name required' });

    // 取该角色的 series/character_name_ja 作为默认值
    const char = db.getSync(
      'SELECT series, character_name_ja, character_name_zh FROM baltan_reference WHERE character_slug = ? LIMIT 1',
      [character_slug]
    );
    const finalSeries = series || char?.series || 'custom';
    const ref_id = nextCustomRefId(character_slug);

    // 处理图片：如果是 http URL，下载到本地
    let localThumb = null, localBig = null;
    if (image_url && /^https?:/.test(image_url)) {
      const dest = path.join(ROOT_LOCAL, character_slug, `${ref_id}.png`);
      try {
        await downloadOnce(image_url, dest);
        localThumb = localImagePath({ character_slug, ref_id });
        // 用同一张图做大图，省事
        const destBig = path.join(ROOT_LOCAL, character_slug, `${ref_id}-big.png`);
        fs.copyFileSync(dest, destBig);
        localBig = localBigImagePath({ character_slug, ref_id });
      } catch (e) {
        return res.status(502).json({ error: '下载图片失败: ' + e.message });
      }
    } else if (image_url && image_url.startsWith('/uploads/')) {
      localThumb = image_url;
      localBig = image_url;
    }

    db.runSync(
      `INSERT INTO baltan_reference
        (ref_id, generation, source, detail_url, image_url, image_big_url, position, series, character_slug, character_name_ja, character_name_zh, brand, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        ref_id, 0, source || 'custom', detail_url || null,
        localThumb, localBig, 9999,
        finalSeries, character_slug,
        char?.character_name_ja || null, char?.character_name_zh || null,
        brand || null
      ]
    );
    res.json({ ok: true, ref_id, image_url: withVersion(localThumb), image_big_url: withVersion(localBig) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 新增一个独立的第三方角色（自动创建第一个玩具）
router.post('/custom-character', async (req, res) => {
  try {
    const {
      character_slug, character_name_ja, character_name_zh,
      series,
      first_toy: { name, source, brand, image_url, detail_url } = {}
    } = req.body || {};
    if (!character_slug || !character_name_ja || !name) {
      return res.status(400).json({ error: 'character_slug, character_name_ja, first_toy.name required' });
    }
    // 检查 slug 冲突
    const existing = db.getSync('SELECT 1 FROM baltan_reference WHERE character_slug = ?', [character_slug]);
    if (existing) return res.status(409).json({ error: `character_slug "${character_slug}" 已存在` });

    const finalSeries = series || 'custom';
    const ref_id = `${character_slug}-c1`;

    let localThumb = null, localBig = null;
    if (image_url && /^https?:/.test(image_url)) {
      const dest = path.join(ROOT_LOCAL, character_slug, `${ref_id}.png`);
      try {
        await downloadOnce(image_url, dest);
        localThumb = localImagePath({ character_slug, ref_id });
        const destBig = path.join(ROOT_LOCAL, character_slug, `${ref_id}-big.png`);
        fs.copyFileSync(dest, destBig);
        localBig = localBigImagePath({ character_slug, ref_id });
      } catch (e) {
        return res.status(502).json({ error: '下载图片失败: ' + e.message });
      }
    } else if (image_url && image_url.startsWith('/uploads/')) {
      localThumb = image_url;
      localBig = image_url;
    }

    db.runSync(
      `INSERT INTO baltan_reference
        (ref_id, generation, source, detail_url, image_url, image_big_url, position, series, character_slug, character_name_ja, character_name_zh, brand, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        ref_id, 0, source || 'custom', detail_url || null,
        localThumb, localBig, 0,
        finalSeries, character_slug,
        character_name_ja, character_name_zh || null,
        brand || null
      ]
    );
    res.json({ ok: true, ref_id, series: finalSeries, character_slug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
