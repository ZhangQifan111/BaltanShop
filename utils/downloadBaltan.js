const https = require('https');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'baltan');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadOnce(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(fs.statSync(dest).size)));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

// 下载某条 ref 的缩略图 + 大图到本地
async function downloadOne(ref) {
  const slug = `${ref.generation}-${ref.ref_id}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const thumbPath = path.join(UPLOAD_DIR, `${slug}.png`);
  const bigPath = path.join(UPLOAD_DIR, `${slug}-big.png`);
  const out = { slug, thumb: null, big: null, errors: [] };

  if (ref.image_url) {
    try {
      // 已存在且非空则跳过
      if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
        out.thumb = { path: thumbPath, size: fs.statSync(thumbPath).size, skipped: true };
      } else {
        const size = await downloadOnce(ref.image_url, thumbPath);
        out.thumb = { path: thumbPath, size, skipped: false };
      }
    } catch (e) {
      out.errors.push(`thumb: ${e.message}`);
    }
  }
  if (ref.image_big_url && ref.image_big_url !== ref.image_url) {
    try {
      if (fs.existsSync(bigPath) && fs.statSync(bigPath).size > 0) {
        out.big = { path: bigPath, size: fs.statSync(bigPath).size, skipped: true };
      } else {
        const size = await downloadOnce(ref.image_big_url, bigPath);
        out.big = { path: bigPath, size, skipped: false };
      }
    } catch (e) {
      out.errors.push(`big: ${e.message}`);
    }
  }
  return out;
}

// 串行下载所有 ref，限并发为 4
async function downloadAll(refs, concurrency = 4) {
  const results = [];
  let done = 0;
  const queue = refs.slice();
  async function worker() {
    while (queue.length) {
      const ref = queue.shift();
      const r = await downloadOne(ref);
      results.push(r);
      done += 1;
      if (done % 5 === 0 || done === refs.length) {
        console.log(`[download] ${done}/${refs.length} done (last: ${r.slug})`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

module.exports = { downloadAll, downloadOne, UPLOAD_DIR };
