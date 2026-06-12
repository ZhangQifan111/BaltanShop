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

// 读旁路文件（记录图片下载自哪个 URL），用于判断是否需要重下
function readSourceUrl(sidecarPath) {
  try {
    return fs.readFileSync(sidecarPath, 'utf8').trim();
  } catch {
    return null;
  }
}

async function downloadOne(ref, opts = {}) {
  const { force = false } = opts;
  if (!ref.character_slug) return { ref_id: ref.ref_id, skipped: true, errors: ['no character_slug'] };
  const dir = path.join(UPLOAD_ROOT, ref.character_slug);
  fs.mkdirSync(dir, { recursive: true });
  const thumbPath = path.join(dir, `${ref.ref_id}.png`);
  const thumbSidecar = `${thumbPath}.url`;
  const bigPath = path.join(dir, `${ref.ref_id}-big.png`);
  const bigSidecar = `${bigPath}.url`;
  const out = { ref_id: ref.ref_id, thumb: null, big: null, errors: [] };

  // 单图决策：file 存在 && sidecar 存在 && URL 一致 → 跳过（最新）
  //          file 存在 && sidecar 不存在 → 跳过（legacy，不打扰）
  //          其他 → 下载并写 sidecar
  async function fetchIfNeeded(filePath, sidecarPath, url) {
    const fileExists = fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
    const sidecarUrl = readSourceUrl(sidecarPath);
    const isLegacy = fileExists && sidecarUrl === null;
    const isUpToDate = fileExists && sidecarUrl !== null && sidecarUrl === url;

    if (!force && (isUpToDate || isLegacy)) {
      return { path: filePath, size: fs.statSync(filePath).size, skipped: true };
    }
    const size = await downloadOnce(url, filePath);
    fs.writeFileSync(sidecarPath, url);
    return { path: filePath, size, skipped: false };
  }

  const tasks = [];
  if (ref.image_url) {
    tasks.push((async () => {
      try {
        out.thumb = await fetchIfNeeded(thumbPath, thumbSidecar, ref.image_url);
      } catch (e) {
        out.errors.push(`thumb: ${e.message}`);
      }
    })());
  }
  if (ref.image_big_url && ref.image_big_url !== ref.image_url) {
    tasks.push((async () => {
      try {
        out.big = await fetchIfNeeded(bigPath, bigSidecar, ref.image_big_url);
      } catch (e) {
        out.errors.push(`big: ${e.message}`);
      }
    })());
  }
  await Promise.all(tasks);
  return out;
}

async function downloadAll(refs, concurrency = 8, onProgress = () => {}, opts = {}) {
  const results = [];
  let done = 0;
  const queue = refs.slice();
  async function worker() {
    while (queue.length) {
      const ref = queue.shift();
      const r = await downloadOne(ref, opts);
      results.push(r);
      done += 1;
      if (done % 10 === 0 || done === refs.length) onProgress(done, refs.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

module.exports = { downloadAll, downloadOne, UPLOAD_ROOT };
