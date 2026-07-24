// 任你购图片下载工具集（importRenrigou + fixRenrigouImages 共用）
const https = require('https');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// 任你购代理 URL（rl.rng.vip/...）里 base64 编码了真实源 URL，解码出来直接下载更稳
function decodeRngImg(url) {
  try {
    const m = (url || '').match(/rl[^\/]*\.rng\.vip\/([A-Za-z0-9+/=]+)/);
    if (!m) return null;
    return Buffer.from(m[1], 'base64').toString('utf8');
  } catch { return null; }
}

// 单次下载（跟随一次 30x 重定向）
function downloadImageOnce(imgUrl, destPath, referer) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    let url;
    try { url = new URL(imgUrl); } catch { try { fs.unlinkSync(destPath); } catch {} return resolve(false); }
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer || 'https://rl.rngmoe.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      timeout: 8000
    };
    const req = https.get(opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(destPath); } catch {}
        const loc = res.headers.location;
        if (loc) return downloadImageOnce(loc, destPath, referer).then(resolve);
        return resolve(false);
      }
      if (res.statusCode !== 200) { file.close(); try { fs.unlinkSync(destPath); } catch {} return resolve(false); }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
      file.on('error', () => { try { fs.unlinkSync(destPath); } catch {} resolve(false); });
    });
    req.on('error', () => { try { fs.unlinkSync(destPath); } catch {} resolve(false); });
    req.setTimeout(8000, () => { req.destroy(new Error('timeout')); try { fs.unlinkSync(destPath); } catch {} resolve(false); });
  });
}

// 重试下载：最多 3 次（间隔 500ms / 1s / 2s 退避 — 图片失败基本是源站问题，没必要等太久）
async function downloadImageWithRetry(imgUrl, destPath, referer) {
  const delays = [0, 500, 1000, 2000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    const ok = await downloadImageOnce(imgUrl, destPath, referer);
    if (ok) return attempt + 1;
  }
  return 0;
}

// 并发执行器（信号量）
async function runWithConcurrency(items, max, fn, onProgress) {
  const results = new Array(items.length);
  let cursor = 0, done = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  }
  const workers = Array.from({ length: Math.min(max, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// 把任一 image_url 下载到 uploads/renrigou_{itemId}.{ext}，返回结果对象
async function fetchAndSaveImage(imageUrl, itemId, opts = {}) {
  const { forceRedownload = false } = opts;
  if (!imageUrl) return { ok: false, reason: 'no_url', attempts: 0 };

  const ext = (imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[0]) || '.jpg';
  const fname = 'renrigou_' + itemId + ext;
  const dest = path.join(UPLOADS_DIR, fname);
  const localPath = '/uploads/' + fname;

  if (!forceRedownload && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { ok: true, localPath, attempts: 1, skipped: true };
  }

  // 优先用解码后的原始 URL（更稳，代理 URL 经常 403）
  const original = decodeRngImg(imageUrl);
  if (original) {
    const a = await downloadImageWithRetry(original, dest, 'https://buyee.jp/');
    if (a > 0) return { ok: true, localPath, attempts: a, source: 'original' };
  }
  // 回落到代理 URL
  const a = await downloadImageWithRetry(imageUrl, dest, 'https://rl.rngmoe.com/');
  if (a > 0) return { ok: true, localPath, attempts: a, source: 'proxy' };

  try { fs.unlinkSync(dest); } catch {}
  return { ok: false, reason: 'download_failed', attempts: 4 };
}

// 判断本地 image 字段对应的文件是否存在
function localFileExists(imagePath) {
  if (!imagePath) return false;
  if (imagePath.startsWith('http')) return false;
  // imagePath 形如 /uploads/xxx
  const rel = imagePath.replace(/^\/+/, '');
  const abs = path.join(__dirname, '..', rel);
  return fs.existsSync(abs) && fs.statSync(abs).size > 0;
}

module.exports = {
  decodeRngImg,
  downloadImageOnce,
  downloadImageWithRetry,
  runWithConcurrency,
  fetchAndSaveImage,
  localFileExists,
  UPLOADS_DIR,
};
