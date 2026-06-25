// 修复存量远程图片 → 解码 rng.vip 代理 URL → 从原始来源重新下载
const initSqlJs = require('sql.js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'data.db');
const UPLOADS = path.join(__dirname, 'uploads');

function decodeRngImg(url) {
  try {
    const m = (url || '').match(/rl[^\/]*\.rng\.vip\/([A-Za-z0-9+/=]+)/);
    if (!m) return null;
    return Buffer.from(m[1], 'base64').toString('utf8');
  } catch { return null; }
}

function downloadImage(imgUrl, destPath, referer) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    const url = new URL(imgUrl);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer || 'https://buyee.jp/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      timeout: 15000
    };
    https.get(opts, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(destPath, () => {}); return resolve(false); }
      res.pipe(file);
      file.on('finish', () => resolve(true));
      file.on('error', () => { fs.unlink(destPath, () => {}); resolve(false); });
    }).on('error', () => { fs.unlink(destPath, () => {}); resolve(false); });
  });
}

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const rows = db.exec("SELECT id, image FROM toys WHERE image LIKE 'http%'");
  if (!rows[0] || rows[0].values.length === 0) {
    console.log('没有需要修复的远程图片');
    return;
  }

  const items = rows[0].values;
  console.log(`找到 ${items.length} 条远程图片，开始修复...\n`);

  let success = 0, decoded = 0, directFail = 0, totalFail = 0;
  for (let i = 0; i < items.length; i++) {
    const [id, url] = items[i];
    const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[0] || '.jpg';
    const fname = `renrigou_fix_${id}${ext}`;
    const dest = path.join(UPLOADS, fname);
    const destRel = '/uploads/' + fname;

    if (fs.existsSync(dest)) {
      db.run('UPDATE toys SET image = ? WHERE id = ?', [destRel, id]);
      success++;
      continue;
    }

    let ok = false;

    // 尝试解码 rng.vip 代理 URL，从原始来源下载
    const original = decodeRngImg(url);
    if (original) {
      decoded++;
      ok = await downloadImage(original, dest, 'https://buyee.jp/');
      if (ok) {
        db.run('UPDATE toys SET image = ? WHERE id = ?', [destRel, id]);
        success++;
      }
    }

    // 解码失败或原始来源下载失败 → 试原 CDN URL
    if (!ok) {
      const directOk = await downloadImage(url, dest, 'https://rl.rngmoe.com/');
      if (directOk) {
        db.run('UPDATE toys SET image = ? WHERE id = ?', [destRel, id]);
        success++;
      } else {
        if (original) totalFail++; else directFail++;
      }
    }

    if ((i + 1) % 20 === 0 || i === items.length - 1) {
      console.log(`进度: ${i + 1}/${items.length}  成功 ${success}  失败 ${totalFail + directFail}`);
    }
  }

  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log(`\n完成！成功 ${success} 条，失败 ${totalFail + directFail} 条（${decoded} 条从原始来源恢复）`);
})();
