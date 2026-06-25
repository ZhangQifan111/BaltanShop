const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const db = require('../db/database');
const { refreshDatabase } = require('../utils/scrapeXplus');
const { downloadAll, UPLOAD_ROOT } = require('../utils/downloadXplus');
const path = require('path');
const fs = require('fs');

const ROOT_LOCAL = path.join(__dirname, '..', 'uploads', 'xplus');
const DL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function withVersion(p) {
  if (!p || p.startsWith('http')) return p;
  const local = path.join(ROOT_LOCAL, p.replace(/^\/uploads\/xplus\//, ''));
  try { return p + '?v=' + Math.floor(fs.statSync(local).mtimeMs); } catch { return p; }
}

// GET /api/xplus/series - 返回所有系列及产品计数
router.get('/series', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT series, series_name_ja, COUNT(*) AS items, COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) AS with_image
       FROM xplus_reference
       GROUP BY series
       ORDER BY series`
    );
    res.json({ series: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/xplus/characters - 返回所有角色及版本计数
router.get('/characters', async (req, res) => {
  try {
    const { series } = req.query;
    let where = 'WHERE character_name IS NOT NULL';
    const params = [];
    if (series) {
      where += ' AND series = ?';
      params.push(series);
    }
    const rows = await db.all(
      `SELECT character_name, COUNT(*) AS count,
              (SELECT image_url FROM xplus_reference r2 WHERE r2.character_name = r1.character_name AND r2.image_url IS NOT NULL AND r2.image_url != '' LIMIT 1) AS image_url,
              GROUP_CONCAT(DISTINCT series) AS series_list
       FROM xplus_reference r1
       ${where}
       GROUP BY character_name
       ORDER BY count DESC`,
      params
    );
    res.json({ characters: rows.map(r => ({
      ...r,
      image_url: withVersion(r.image_url),
      series_list: r.series_list ? r.series_list.split(',') : [],
    })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/xplus/items?series= or ?character= - 返回产品列表
router.get('/items', async (req, res) => {
  try {
    const { series, character } = req.query;
    let sql = 'SELECT * FROM xplus_reference WHERE 1=1';
    const params = [];
    if (series) { sql += ' AND series = ?'; params.push(series); }
    if (character) { sql += ' AND character_name = ?'; params.push(character); }
    sql += ' ORDER BY position, id';
    const rows = await db.all(sql, params);
    res.json({ items: rows.map(r => ({
      ...r,
      image_url: withVersion(r.image_url),
      images: r.images ? (() => { try { return JSON.parse(r.images).map(u => withVersion(u)); } catch { return null; } })() : null,
    })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/xplus/item/:ref_id - 单个产品详情
router.get('/item/:ref_id', async (req, res) => {
  try {
    const row = await db.get('SELECT * FROM xplus_reference WHERE ref_id = ?', [req.params.ref_id]);
    if (!row) return res.status(404).json({ error: 'not found' });
    row.image_url = withVersion(row.image_url);
    row.images = row.images ? (() => { try { return JSON.parse(row.images).map(u => withVersion(u)); } catch { return null; } })() : null;
    res.json({ item: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/xplus/refresh - 触发爬虫刷新数据
router.post('/refresh', async (req, res) => {
  try {
    const onProgress = (info) => {
      if (info.type === 'progress') {
        process.stdout.write(`\r  爬取中... ${info.done}/${info.total} (${info.results} 成功, ${info.errors} 失败)`);
      }
    };
    const { count, errors, total } = await refreshDatabase(db, { concurrency: 4, onProgress });
    process.stdout.write('\n');
    res.json({ ok: true, count, errors: errors.length, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/xplus/download-images - 下载图片到本地
router.post('/download-images', async (req, res) => {
  try {
    const { force } = req.query;
    const refs = await db.all(
      `SELECT * FROM xplus_reference WHERE (image_url LIKE 'http%' OR images IS NOT NULL)`
    );
    let total_bytes = 0;
    let downloaded = 0;
    let skipped = 0;
    const errors = [];

    const results = await downloadAll(refs, 8, (done, total) => {
      process.stdout.write(`\r  下载图片中... ${done}/${total}`);
    }, { force: force === '1' || force === 'true' });

    process.stdout.write('\n');

    for (const r of results) {
      for (const img of r.images) {
        if (img.status === 'downloaded') { downloaded++; total_bytes += (img.size || 0); }
        else if (img.status === 'skipped') skipped++;
      }
      if (r.errors.length) errors.push({ ref_id: r.ref_id, errors: r.errors });

      // 更新 DB：image_url + images 都指向本地路径
      const localImgs = r.images.filter(i => i.local).map(i => i.local);
      if (localImgs.length > 0) {
        await db.update('UPDATE xplus_reference SET image_url = ?, images = ? WHERE ref_id = ?',
          [localImgs[0], JSON.stringify(localImgs), r.ref_id]);
      }
    }

    res.json({
      ok: true, count: refs.length, downloaded, skipped,
      total_bytes, errors: errors.length ? errors : undefined
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
