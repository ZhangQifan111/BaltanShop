// 补救 v3:对所有缺图的 ref,重爬拿到原始 CDN URL 后下载,只在成功时写本地路径;失败时回退到 CDN URL
const db = require('../db/database');
const { scrapeCharacter } = require('./scrapeMonsters');
const { downloadOne } = require('./downloadMonsters');
const path = require('path');
const fs = require('fs');

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

  const byChar = new Map();
  for (const r of toFix) {
    const k = `${r.series}/${r.character_slug}`;
    if (!byChar.has(k)) byChar.set(k, []);
    byChar.get(k).push(r);
  }
  console.log(`涉及 ${byChar.size} 个角色页`);

  let dlOk = 0, dlFail = 0, dlThrew = 0, fetchFailed = 0, notInItems = 0;
  let keepCdn = 0;  // 下载失败但回退到 CDN 的计数
  let charIdx = 0;
  for (const [key, refs] of byChar) {
    charIdx += 1;
    const [series, slug] = key.split('/');
    let items;
    try {
      items = await scrapeCharacter(series, slug);
    } catch (e) {
      console.log(`  ! fetch ${key} failed: ${e.message}`);
      fetchFailed += 1;
      continue;
    }
    const byRefId = new Map(items.map(it => [it.ref_id, it]));
    for (const r of refs) {
      const it = byRefId.get(r.ref_id);
      if (!it) { notInItems += 1; continue; }
      let ok = false;
      try {
        const res = await downloadOne(it);
        if (res.errors.length === 0) {
          // 验证文件确实在
          const tp = path.join('/opt/buy-ledger-v2', `/uploads/monster/${r.character_slug}/${r.ref_id}.png`);
          if (fs.existsSync(tp)) { dlOk += 1; ok = true; }
        } else {
          dlFail += 1;
        }
      } catch (e) { dlThrew += 1; }
      if (ok) {
        // 写本地路径
        const thumb = `/uploads/monster/${r.character_slug}/${r.ref_id}.png`;
        const big = `/uploads/monster/${r.character_slug}/${r.ref_id}-big.png`;
        db.update('UPDATE baltan_reference SET image_url=?, image_big_url=? WHERE ref_id=?', [thumb, big, r.ref_id]);
      } else {
        // 回退到 CDN URL (用 it.image_url/image_big_url)
        const thumb = it.image_url || r.image_url;
        const big = it.image_big_url || r.image_big_url;
        if (thumb && thumb.startsWith('http')) {
          db.update('UPDATE baltan_reference SET image_url=?, image_big_url=? WHERE ref_id=?', [thumb, big, r.ref_id]);
          keepCdn += 1;
        }
      }
    }
    if (charIdx % 10 === 0 || charIdx === byChar.size) {
      process.stdout.write(`  ${charIdx}/${byChar.size} chars, dl ok:${dlOk} fail:${dlFail} threw:${dlThrew} keepCdn:${keepCdn}\r`);
    }
  }
  process.stdout.write('\n');
  console.log(`\nDONE: ${byChar.size} chars, ${fetchFailed} fetch-failed, ${notInItems} not-in-items`);
  console.log(`  dl ok: ${dlOk}, fail: ${dlFail}, threw: ${dlThrew}, keep-cdn: ${keepCdn}`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
