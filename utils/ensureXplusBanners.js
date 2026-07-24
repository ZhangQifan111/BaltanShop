// 自动确保 Xplus 页面 banner 图齐全
// 来源：museum.ric-toy.com 首页 /museum.img/ 目录（无鉴权）
// 设计：幂等 — 已存在且 >0 字节的文件跳过；只下载缺失的
// 触发时机：POST /api/xplus/refresh 入口会自动调用
//          也可手动 `node utils/ensureXplusBanners.js`

const fs = require('fs');
const path = require('path');
const https = require('https');

const BANNER_ROOT = path.join(__dirname, '..', 'uploads', 'xplus', 'banners');
const MUSEUM_BASE = 'https://museum.ric-toy.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Safari/605.15.15';

// 23 个 banner：short -> [URL 候选列表，按顺序尝试]
// top_title.gif 是页面大标题，单独写一行；其他是各系列背景图
const BANNERS = {
  'top_title.gif': [`${MUSEUM_BASE}/museum_list/top_title.gif`],
  'back_img.jpg':  [`${MUSEUM_BASE}/header_link_img.jpg`],

  'ultraq.jpg':    [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_ultraq.jpg`, `${MUSEUM_BASE}/museum.img/museum_ultraq.jpg`],
  'man.jpg':       [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_man.jpg`,    `${MUSEUM_BASE}/museum.img/museum_man.jpg`],
  'seven.jpg':     [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_seven.jpg`,  `${MUSEUM_BASE}/museum.img/museum_seven.jpg`],
  'reultra.jpg':   [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_reultra.jpg`,`${MUSEUM_BASE}/museum.img/museum_reultra.jpg`],
  'ace.jpg':       [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_ace.jpg`,    `${MUSEUM_BASE}/museum.img/museum_ace.jpg`],
  'taro.jpg':      [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_taro.jpg`,   `${MUSEUM_BASE}/museum.img/museum_taro.jpg`],
  'magma.jpg':     [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_magma.jpg`,  `${MUSEUM_BASE}/museum.img/museum_magma.jpg`],
  'soutennen.jpg': [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_soutennen.jpg`, `${MUSEUM_BASE}/museum.img/museum_soutennen.jpg`],
  'sekai.jpg':     [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_sekai.jpg`,  `${MUSEUM_BASE}/museum.img/museum_sekai.jpg`],
  'ung.jpg':       [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_ung.jpg`,    `${MUSEUM_BASE}/museum.img/museum_ung.jpg`],
  'daiei.jpg':     [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_daiei.jpg`,  `${MUSEUM_BASE}/museum.img/museum_daiei.jpg`],
  'pp.jpg':        [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_pp.jpg`,     `${MUSEUM_BASE}/museum.img/museum_pp.jpg`],
  'boosuka.jpg':   [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_boosuka.jpg`,`${MUSEUM_BASE}/museum.img/museum_boosuka.jpg`],
  // toho20cm: museum 没有专属 banner，临时复用 toho30 的（视觉都是"东宝"系）
  'toho20.jpg':    [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_toho30.jpg`, `${MUSEUM_BASE}/museum.img/museum_toho30.jpg`],
  'toho30.jpg':    [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_toho30.jpg`, `${MUSEUM_BASE}/museum.img/museum_toho30.jpg`],
  'daiei30.jpg':   [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_daiei30.jpg`,`${MUSEUM_BASE}/museum.img/museum_daiei30.jpg`],
  'rmc.jpg':       [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_rmc.jpg`,    `${MUSEUM_BASE}/museum.img/museum_rmc.jpg`],
  'dage.jpg':      [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_dage.jpg`,   `${MUSEUM_BASE}/museum.img/museum_dage.jpg`],
  'hhfl.jpg':      [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_hhfl.jpg`,   `${MUSEUM_BASE}/museum.img/museum_hhfl.jpg`],
  'youkai.jpg':    [`${MUSEUM_BASE}/museum.img/Museum_SeriesTitle_youkai.jpg`, `${MUSEUM_BASE}/museum.img/museum_youkai.jpg`],
  // dkjs (大怪獣シリーズ まとめ) 用 tohodaikaiju 凑合
  'dkjs.jpg':      [`${MUSEUM_BASE}/museum.img/museum_tohodaikaiju.jpg`],
};

function downloadOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadOnce(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
  });
}

async function ensureOne(filename, candidates) {
  const dest = path.join(BANNER_ROOT, filename);
  // 已存在且 >1KB 视为有效（403 错误页约 100 字节）
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
    return { filename, status: 'exists', size: fs.statSync(dest).size };
  }
  for (const url of candidates) {
    try {
      const buf = await downloadOnce(url);
      if (buf.length < 200) continue; // 跳过错误页
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      return { filename, status: 'downloaded', size: buf.length, from: url };
    } catch (e) {
      // 试下一个候选
    }
  }
  return { filename, status: 'failed', error: 'all candidates failed' };
}

/**
 * 检查并下载缺失的 banner
 * @param {Function} [onProgress] (result) => void
 * @returns {Promise<Array>}
 */
async function ensureBanners(onProgress = () => {}) {
  fs.mkdirSync(BANNER_ROOT, { recursive: true });
  const out = [];
  for (const [filename, candidates] of Object.entries(BANNERS)) {
    const r = await ensureOne(filename, candidates);
    out.push(r);
    onProgress(r);
  }
  return out;
}

// CLI: node utils/ensureXplusBanners.js
if (require.main === module) {
  ensureBanners((r) => {
    if (r.status === 'downloaded') console.log(`  ✓ ${r.filename}  (${r.size}B from ${r.from.split('/').pop()})`);
    else if (r.status === 'exists') console.log(`  · ${r.filename}  (已存在, ${r.size}B)`);
    else console.log(`  ✗ ${r.filename}  (${r.error})`);
  }).then((results) => {
    const downloaded = results.filter(r => r.status === 'downloaded').length;
    const failed = results.filter(r => r.status === 'failed').length;
    console.log(`\n完成: 新下 ${downloaded}, 失败 ${failed}/${results.length}`);
    if (failed > 0) process.exit(1);
  });
}

module.exports = { ensureBanners, BANNERS, BANNER_ROOT };
