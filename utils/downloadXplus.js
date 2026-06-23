const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'xplus');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadOnce(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(fs.statSync(dest).size)));
      file.on('error', reject);
    });
    req.on('error', (e) => { try { fs.unlinkSync(dest); } catch {}; reject(e); });
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

function readSidecarUrl(sidecarPath) {
  try { return fs.readFileSync(sidecarPath, 'utf8').trim(); } catch { return null; }
}

async function downloadOne(ref, opts = {}) {
  const { force = false } = opts;
  const out = { ref_id: ref.ref_id, images: [], errors: [] };

  // 收集所有图片 URL（image_url + images JSON 里的）
  const urls = [];
  if (ref.image_url) urls.push({ url: ref.image_url, suffix: '' });
  if (ref.images) {
    try {
      const arr = JSON.parse(ref.images);
      arr.forEach((u, i) => {
        if (u !== ref.image_url) urls.push({ url: u, suffix: `_${i + 1}` });
      });
    } catch {}
  }

  for (const { url, suffix } of urls) {
    if (!url || !url.startsWith('http')) {
      // 已是本地路径，跳过
      out.images.push({ url, local: url, status: 'local' });
      continue;
    }
    const ext = path.extname(url) || '.jpg';
    const fname = `${ref.ref_id}${suffix}${ext}`;
    const filePath = path.join(UPLOAD_ROOT, fname);
    const sidecarPath = `${filePath}.url`;

    const fileExists = fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
    const sidecarUrl = readSidecarUrl(sidecarPath);
    const isUpToDate = fileExists && sidecarUrl === url;
    const isLegacy = fileExists && sidecarUrl === null;

    if (!force && (isUpToDate || isLegacy)) {
      out.images.push({ url, local: `/uploads/xplus/${fname}`, status: 'skipped' });
      continue;
    }

    try {
      const size = await downloadOnce(url, filePath);
      fs.writeFileSync(sidecarPath, url);
      out.images.push({ url, local: `/uploads/xplus/${fname}`, size, status: 'downloaded' });
    } catch (e) {
      out.errors.push(`${fname}: ${e.message}`);
      out.images.push({ url, local: null, status: 'error' });
    }
  }

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
