// 一次性修复: 对 DB 里所有已有角色, 重新拉 title 修正 character_name_ja
// 不删数据, 不下载图, 只 UPDATE 一个字段
const https = require('https');
const db = require('../db/database');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const BASE = 'https://www.ultrakaijyu.com';

function fetch(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location, retries).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', (e) => {
      if (retries > 0) {
        setTimeout(() => fetch(url, retries - 1).then(resolve, reject), 500);
      } else reject(e);
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

(async () => {
  await db.getDb();
  const rows = db.allSync(`
    SELECT series, character_slug, MAX(character_name_ja) AS old_name
    FROM baltan_reference
    WHERE character_slug IS NOT NULL
    GROUP BY series, character_slug
    ORDER BY series, character_slug
  `);
  console.log(`checking ${rows.length} characters...`);

  let fixed = 0, unchanged = 0, failed = 0;
  for (const r of rows) {
    const url = `${BASE}/${r.series}/${r.character_slug}.html`;
    try {
      const html = await fetch(url);
      const m = html.match(/<title>([^<]+?)\s+of\s+ウルトラ怪獣\.com<\/title>/);
      if (!m) { console.log(`  ! no title: ${r.series}/${r.character_slug}`); failed += 1; continue; }
      const newName = m[1].trim();
      if (newName === r.old_name) { unchanged += 1; continue; }
      db.update('UPDATE baltan_reference SET character_name_ja = ? WHERE series = ? AND character_slug = ?',
        [newName, r.series, r.character_slug]);
      console.log(`  ${r.series}/${r.character_slug}: "${r.old_name}" → "${newName}"`);
      fixed += 1;
    } catch (e) {
      console.log(`  ! ${r.series}/${r.character_slug}: ${e.message}`);
      failed += 1;
    }
  }
  console.log(`\nfixed: ${fixed}, unchanged: ${unchanged}, failed: ${failed}`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
