// 补救 v2:对所有缺图的 ref,重新爬该角色页拿到原始 CDN URL,然后下载
const db = require('../db/database');
const { scrapeCharacter } = require('./scrapeMonsters');
const { downloadOne } = require('./downloadMonsters');
const path = require('path');
const fs = require('fs');
const https = require('https');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

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
    req.on('error', (e) => { if (retries > 0) setTimeout(() => fetch(url, retries-1).then(resolve, reject), 500); else reject(e); });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

// 把本地路径还原成 https://www.ultrakaijyu.com/... 原始 URL
function revertLocalToCdn(localOrHttp) {
  if (!localOrHttp) return null;
  if (localOrHttp.startsWith('http')) return localOrHttp;
  if (localOrHttp.startsWith('/uploads/')) {
    // /uploads/monster/{slug}/{ref_id}.png -> https://www.ultrakaijyu.com/{series}/{slug}/{ref_id}.png
    // /uploads/monster/{slug}/{ref_id}-big.png -> big version
    const m = localOrHttp.match(/\/uploads\/monster\/([^/]+)\/(.+)\.png$/);
    if (!m) return null;
    const slug = m[1], refId = m[2];
    const isBig = refId.endsWith('-big');
    const baseRef = isBig ? refId.replace(/-big$/, '') : refId;
    // baseRef 格式 "{characterSlug}-{nn}" - 但 URL 路径是 {series}/{characterSlug}/... 没办法知道 series
    // 必须用 DB 反查
    return null;  // 我们改用 DB 反查
  }
  return null;
}

// 直接从 DB ref_id 反推 CDN URL
function reconstructCdnUrl(ref) {
  // ref.ref_id 格式 "{characterSlug}-{nn}"
  const m = ref.ref_id.match(/^(.+)-(\d+)$/);
  if (!m) return null;
  const slug = m[1], num = m[2];
  if (!ref.series) return null;
  // 原网站路径: /{series}/{slug}.html 内嵌 ../_src/.../{num}.png (缩略) 和 big.png (大)
  // 缩略图路径: /_src/{series}/{slug}/{num}.png (大致,可能 1-2 段前缀)
  // 我们用之前 scrapeMonsters.parseCharacterPage 拿到的 image_url 模式: /{series}/{slug}/{num}.png 之类
  // 但这个文件是 ref 的 image_url,我们想从角色页 HTML 重新抓
  return null;
}

(async () => {
  await db.getDb();
  const all = db.allSync("SELECT * FROM baltan_reference");
  const toFix = [];
  for (const r of all) {
    const tp = r.image_url && !r.image_url.startsWith('http') ? path.join('/opt/buy-ledger-v2', r.image_url) : null;
    const bp = r.image_big_url && !r.image_big_url.startsWith('http') ? path.join('/opt/buy-ledger-v2', r.image_big_url) : null;
    const needThumb = !tp || !fs.existsSync(tp);
    const needBig = !bp || !fs.existsSync(bp);
    if (needThumb || needBig) toFix.push(r);
  }
  console.log(`待补救: ${toFix.length} 个 ref`);

  // 按 series+character_slug 分组,每个组只爬一次角色页
  const byChar = new Map();
  for (const r of toFix) {
    const k = `${r.series}/${r.character_slug}`;
    if (!byChar.has(k)) byChar.set(k, []);
    byChar.get(k).push(r);
  }
  console.log(`涉及 ${byChar.size} 个角色页`);

  let dlOk = 0, dlFail = 0, scraped = 0, fetchFailed = 0;
  for (const [key, refs] of byChar) {
    const [series, slug] = key.split('/');
    let items;
    try {
      items = await scrapeCharacter(series, slug);
      scraped += 1;
    } catch (e) {
      console.log(`  ! fetch ${key} failed: ${e.message}`);
      fetchFailed += 1;
      continue;
    }
    const byRefId = new Map(items.map(it => [it.ref_id, it]));
    for (const r of refs) {
      const it = byRefId.get(r.ref_id);
      if (!it) { dlFail += 1; console.log(`  ! ${r.ref_id}: not in scraped items`); continue; }
      try {
        const res = await downloadOne(it);  // 传带原始 URL 的 item
        if (res.errors.length) { dlFail += 1; console.log(`  ! ${r.ref_id}: ${res.errors.join('; ')}`); }
        else { dlOk += 1; }
      } catch (e) { dlFail += 1; console.log(`  ! ${r.ref_id}: ${e.message}`); }
      // 更新 DB 路径(覆盖之前的)
      if (r.character_slug) {
        const thumb = `/uploads/monster/${r.character_slug}/${r.ref_id}.png`;
        const big = `/uploads/monster/${r.character_slug}/${r.ref_id}-big.png`;
        db.update('UPDATE baltan_reference SET image_url=?, image_big_url=? WHERE ref_id=?', [thumb, big, r.ref_id]);
      }
    }
  }
  console.log(`\nDONE: scraped ${scraped} chars, dl ${dlOk} ok, ${dlFail} fail, fetch-failed ${fetchFailed}`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
