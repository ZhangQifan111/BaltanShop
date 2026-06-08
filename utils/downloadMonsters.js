const https = require('https');
const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'monster');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

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
    req.on('error', (e) => {
      try { fs.unlinkSync(dest); } catch {}
      reject(e);
    });
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

async function downloadOne(ref) {
  if (!ref.character_slug) return { ref_id: ref.ref_id, skipped: true, errors: ['no character_slug'] };
  const dir = path.join(UPLOAD_ROOT, ref.character_slug);
  fs.mkdirSync(dir, { recursive: true });
  const thumbPath = path.join(dir, `${ref.ref_id}.png`);
  const bigPath = path.join(dir, `${ref.ref_id}-big.png`);
  const out = { ref_id: ref.ref_id, thumb: null, big: null, errors: [] };

  // thumb 和 big 并行下载
  const tasks = [];
  if (ref.image_url) {
    tasks.push((async () => {
      try {
        if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
          out.thumb = { path: thumbPath, size: fs.statSync(thumbPath).size, skipped: true };
        } else {
          const size = await downloadOnce(ref.image_url, thumbPath);
          out.thumb = { path: thumbPath, size, skipped: false };
        }
      } catch (e) {
        out.errors.push(`thumb: ${e.message}`);
      }
    })());
  }
  if (ref.image_big_url && ref.image_big_url !== ref.image_url) {
    tasks.push((async () => {
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
    })());
  }
  await Promise.all(tasks);
  return out;
}

async function downloadAll(refs, concurrency = 8, onProgress = () => {}) {
  const results = [];
  let done = 0;
  const queue = refs.slice();
  async function worker() {
    while (queue.length) {
      const ref = queue.shift();
      const r = await downloadOne(ref);
      results.push(r);
      done += 1;
      if (done % 10 === 0 || done === refs.length) onProgress(done, refs.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

module.exports = { downloadAll, downloadOne, UPLOAD_ROOT };
