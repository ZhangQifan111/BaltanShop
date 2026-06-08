// 一次性补 7 个英雄角色 (主角本人),不删任何已有数据
// 受影响 series: ultraman / return-of-ultraman / ultraseven / ultraman-ace / ultraman-leo / ultramantaro / ultraman80
// (ultraq 是纪录片,无英雄;others 也不固定英雄)
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { downloadOne, UPLOAD_ROOT } = require('./downloadMonsters');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const BASE = 'https://www.ultrakaijyu.com';

const HEROES = [
  { series: 'ultraman',         slug: 'ultraman',         name_zh: '初代奥特曼' },
  { series: 'return-of-ultraman', slug: 'return-of-ultraman', name_zh: '杰克奥特曼' },
  { series: 'ultraseven',       slug: 'ultraseven',       name_zh: '赛文奥特曼' },
  { series: 'ultraman-ace',     slug: 'ultraman-ace',     name_zh: '艾斯奥特曼' },
  { series: 'ultraman-leo',     slug: 'ultraman-leo',     name_zh: '雷欧奥特曼' },
  { series: 'ultramantaro',     slug: 'ultramantaro',     name_zh: '塔罗奥特曼' },
  { series: 'ultraman80',       slug: 'ultraman80',       name_zh: '80奥特曼' },
];

const SERIES_TO_GEN = {
  'ultraman': 1, 'return-of-ultraman': 2, 'ultraseven': 3,
  'ultraman-ace': 4, 'ultraman-leo': 5, 'ultramantaro': 6,
  'ultraman80': 7,
};

function fetch(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) return fetch(res.headers.location, retries).then(resolve, reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', (e) => { if (retries > 0) setTimeout(() => fetch(url, retries - 1).then(resolve, reject), 500); else reject(e); });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

function parseHeroPage(html, series, slug) {
  // 用统一的 parseCharacterPage (无需重写)
  const { parseCharacterPage } = require('./scrapeMonsters');
  return parseCharacterPage(html, series, slug);
}

function fmt(s) { s = Math.floor(s); return `${Math.floor(s/60)}m${s%60}s`; }

(async () => {
  await db.getDb();
  const t0 = Date.now();
  let totalInserted = 0, totalUpdated = 0, totalDownloaded = 0, totalFailed = 0;
  for (const h of HEROES) {
    console.log(`\n========== ${h.series}/${h.slug} (${h.name_zh}) ==========`);
    const url = `${BASE}/${h.series}/${h.slug}.html`;
    let items;
    try {
      const html = await fetch(url);
      items = parseHeroPage(html, h.series, h.slug);
    } catch (e) {
      console.log(`  fetch failed: ${e.message}`);
      totalFailed += 1;
      continue;
    }
    console.log(`  parsed: ${items.length} items`);

    let inserted = 0, updated = 0, skipped = 0;
    for (const it of items) {
      // 查现有 ref_id
      const existing = db.getSync('SELECT id, image_url FROM baltan_reference WHERE ref_id = ?', [it.ref_id]);
      if (!existing) {
        db.insert(
          'INSERT INTO baltan_reference (ref_id, generation, source, brand, detail_url, image_url, image_big_url, position, series, character_slug, character_name_ja) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [it.ref_id, it.generation, it.source, it.brand, it.detail_url, it.image_url, it.image_big_url, it.position, it.series, it.character_slug, it.character_name_ja]
        );
        inserted += 1;
      } else {
        // 已存在 (例如 alienbaltan-01), 跳过
        skipped += 1;
      }
    }
    console.log(`  DB: inserted ${inserted}, skipped (already exist) ${skipped}`);

    // 下载图
    const refs = db.allSync('SELECT * FROM baltan_reference WHERE series = ? AND character_slug = ?', [h.series, h.slug]);
    let dlOk = 0, dlFail = 0;
    for (const r of refs) {
      try {
        const res = await downloadOne(r);
        if (res.errors.length) { dlFail += 1; console.log(`  ! ${r.ref_id}: ${res.errors.join('; ')}`); }
        else { dlOk += 1; }
      } catch (e) { dlFail += 1; }
      // UPDATE 路径到本地
      const thumb = `/uploads/monster/${r.character_slug}/${r.ref_id}.png`;
      const big = `/uploads/monster/${r.character_slug}/${r.ref_id}-big.png`;
      db.update('UPDATE baltan_reference SET image_url=?, image_big_url=? WHERE ref_id=? AND (image_url LIKE ? OR image_url IS NULL)',
        [thumb, big, r.ref_id, 'http%']);
    }
    totalInserted += inserted;
    totalDownloaded += dlOk;
    totalFailed += dlFail;
  }
  const t1 = Date.now();
  console.log(`\n========== DONE in ${fmt((t1-t0)/1000)} ==========`);
  console.log(`inserted: ${totalInserted}, downloaded: ${totalDownloaded}, failed: ${totalFailed}`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
