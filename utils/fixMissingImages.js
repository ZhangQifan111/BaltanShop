// 补救:对所有 baltan_reference 中缺图 / 仍是外链 的记录,重新下载
const db = require('../db/database');
const { downloadOne } = require('./downloadMonsters');
const path = require('path');
const fs = require('fs');

(async () => {
  await db.getDb();
  const all = db.allSync("SELECT * FROM baltan_reference WHERE image_url IS NULL OR image_url LIKE '/uploads/%' OR image_url LIKE 'http%'");
  const toFix = [];
  for (const r of all) {
    const tp = r.image_url && !r.image_url.startsWith('http') ? path.join('/opt/buy-ledger-v2', r.image_url) : null;
    const bp = r.image_big_url && !r.image_big_url.startsWith('http') ? path.join('/opt/buy-ledger-v2', r.image_big_url) : null;
    const needThumb = !tp || !fs.existsSync(tp);
    const needBig = !bp || !fs.existsSync(bp);
    // 外链:也算缺(优先用本地)
    const isExternal = r.image_url && r.image_url.startsWith('http');
    if (needThumb || needBig || isExternal) toFix.push(r);
  }
  console.log(`待补救: ${toFix.length} 个 ref`);
  let dlOk = 0, dlFail = 0;
  for (let i = 0; i < toFix.length; i++) {
    const r = toFix[i];
    try {
      const res = await downloadOne(r);
      if (res.errors.length) { dlFail += 1; console.log(`  ! ${r.ref_id}: ${res.errors.join('; ')}`); }
      else { dlOk += 1; }
    } catch (e) { dlFail += 1; console.log(`  ! ${r.ref_id}: ${e.message}`); }
    // 不管成功失败,只要 downloadOne 没抛错就把 URL 改成本地
    if (r.character_slug) {
      const thumb = `/uploads/monster/${r.character_slug}/${r.ref_id}.png`;
      const big = `/uploads/monster/${r.character_slug}/${r.ref_id}-big.png`;
      db.update('UPDATE baltan_reference SET image_url=?, image_big_url=? WHERE ref_id=?', [thumb, big, r.ref_id]);
    }
    if ((i+1) % 20 === 0 || i === toFix.length-1) {
      process.stdout.write(`  ${i+1}/${toFix.length}  ok:${dlOk}  fail:${dlFail}\r`);
    }
  }
  process.stdout.write('\n');
  console.log(`\nDONE: ${dlOk} ok, ${dlFail} fail of ${toFix.length}`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
