// 批量缩图:thumb 200px, big 600px, 覆盖原文件
// 安全策略:跳过 mtime < 30s 的文件(防止与下载并发时读到半成品)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', 'uploads', 'monster');
const THUMB_WIDTH = 200;
const BIG_WIDTH = 600;
const SKIP_IF_YOUNGER_MS = 30 * 1000;
const CONCURRENCY = 6;

async function listAll() {
  const out = [];
  const chars = fs.readdirSync(ROOT).filter(d => fs.statSync(path.join(ROOT, d)).isDirectory());
  for (const c of chars) {
    const dir = path.join(ROOT, c);
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.png')) out.push(path.join(dir, f));
    }
  }
  return out;
}

async function processOne(file) {
  let stat;
  try { stat = fs.statSync(file); } catch { return { skipped: 'gone' }; }
  if (Date.now() - stat.mtimeMs < SKIP_IF_YOUNGER_MS) return { skipped: 'too-young' };
  const isBig = file.endsWith('-big.png');
  const targetWidth = isBig ? BIG_WIDTH : THUMB_WIDTH;
  try {
    const meta = await sharp(file).metadata();
    if (meta.width && meta.width <= targetWidth) return { skipped: 'already-small' };
    const before = stat.size;
    const tmp = file + '.tmp';
    await sharp(file, { failOn: 'none' }).resize({ width: targetWidth, withoutEnlargement: true }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(tmp);
    try { fs.renameSync(tmp, file); } catch { try { fs.unlinkSync(tmp); } catch {}; return { skipped: 'gone' }; }
    const after = fs.statSync(file).size;
    return { resized: true, before, after, width: meta.width, newWidth: targetWidth };
  } catch (e) {
    return { error: e.message };
  }
}

function fmt(s) { s = Math.floor(s); return `${Math.floor(s/60)}m${s%60}s`; }

(async () => {
  const t0 = Date.now();
  console.log('扫描...');
  const files = await listAll();
  console.log(`找到 ${files.length} 张图`);
  let done = 0, resized = 0, alreadySmall = 0, tooYoung = 0, errors = 0;
  let totalBefore = 0, totalAfter = 0;
  const queue = files.slice();
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const r = await processOne(f);
      if (r.resized) { resized += 1; totalBefore += r.before; totalAfter += r.after; }
      else if (r.skipped === 'already-small') alreadySmall += 1;
      else if (r.skipped === 'too-young') tooYoung += 1;
      else if (r.error) { errors += 1; console.error(`  ! ${f}: ${r.error}`); }
      done += 1;
      if (done % 100 === 0 || done === files.length) {
        const elapsed = (Date.now() - t0) / 1000;
        const rate = done / elapsed;
        const eta = (files.length - done) / rate;
        process.stdout.write(`  ${done}/${files.length}  resized:${resized}  small:${alreadySmall}  young:${tooYoung}  err:${errors}  saved:${((totalBefore-totalAfter)/1024/1024).toFixed(1)}MB  eta:${fmt(eta)}\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  const t1 = Date.now();
  console.log(`\n========== DONE in ${fmt((t1-t0)/1000)} ==========`);
  console.log(`total: ${files.length}, resized: ${resized}, already-small: ${alreadySmall}, too-young(可能正在下载): ${tooYoung}, errors: ${errors}`);
  console.log(`saved: ${((totalBefore-totalAfter)/1024/1024).toFixed(1)} MB (${(totalBefore/1024/1024).toFixed(0)} MB → ${(totalAfter/1024/1024).toFixed(0)} MB)`);
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
