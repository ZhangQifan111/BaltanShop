// 跑小系列: ultraman80 / ultrafight / corner813560
// 每个系列: refreshDatabase (scrape + 入库) -> downloadAll (下载图)
const db = require('../db/database');
const { refreshDatabase } = require('./scrapeMonsters');
const { downloadAll } = require('./downloadMonsters');

const SERIES = ['ultraman80', 'ultrafight', 'corner813560'];

function fmt(s) {
  s = Math.floor(s);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r}s`;
}

async function runOne(series) {
  console.log(`\n========== ${series} ==========`);
  const t0 = Date.now();

  console.log('[1/2] scraping...');
  const scrapeResult = await refreshDatabase(db, { series, concurrency: 4 });
  const t1 = Date.now();
  console.log(`  scraped: ${scrapeResult.count} items, ${scrapeResult.errors.length} errors, ${fmt((t1 - t0) / 1000)}`);

  if (scrapeResult.errors.length) {
    console.log('  errors:', scrapeResult.errors.slice(0, 3));
  }

  const refs = db.allSync('SELECT * FROM baltan_reference WHERE series = ?', [series]);
  if (!refs.length) {
    console.log('  no refs, skip download');
    return;
  }

  console.log(`[2/2] downloading ${refs.length} refs (8 concurrent)...`);
  let updated = 0, downloaded = 0, skipped = 0, failed = 0;
  let lastLog = 0;
  const dlResults = await downloadAll(refs, 8, (done, total) => {
    if (done - lastLog >= 5 || done === total) {
      process.stdout.write(`  progress: ${done}/${total}\r`);
      lastLog = done;
    }
  });
  process.stdout.write('\n');

  for (const ref of refs) {
    if (!ref.character_slug) continue;
    const thumb = `/uploads/monster/${ref.character_slug}/${ref.ref_id}.png`;
    const big = `/uploads/monster/${ref.character_slug}/${ref.ref_id}-big.png`;
    const wasExt = (ref.image_url && /^https?:/.test(ref.image_url)) ||
                   (ref.image_big_url && /^https?:/.test(ref.image_big_url));
    const wasOld = ref.image_url && ref.image_url.startsWith('/uploads/baltan/');
    if (wasExt || wasOld) {
      db.update('UPDATE baltan_reference SET image_url=?, image_big_url=? WHERE ref_id=?',
        [thumb, big, ref.ref_id]);
      updated += 1;
    }
  }

  for (const r of dlResults) {
    if (r.thumb?.skipped) skipped += 1;
    else if (r.thumb) downloaded += 1;
    if (r.errors.length) failed += 1;
  }

  const t2 = Date.now();
  console.log(`  downloaded: ${downloaded}, skipped: ${skipped}, failed: ${failed}, db-updated: ${updated}`);
  console.log(`  total: ${fmt((t2 - t0) / 1000)}`);
}

(async () => {
  await db.getDb();
  const t0 = Date.now();
  for (const s of SERIES) {
    await runOne(s);
  }
  const t1 = Date.now();
  console.log(`\n========== ALL DONE: ${fmt((t1 - t0) / 1000)} ==========`);
  process.exit(0);
})().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
