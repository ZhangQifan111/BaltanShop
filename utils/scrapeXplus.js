const https = require('https');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const BASE = 'https://museum.ric-toy.com';

// 系列页 -> series slug + 日文名
const SERIES_MAP = [
  { url: '/museum_ultraq.html', series: 'ultraq', name_ja: '大怪獣シリーズ ウルトラQ' },
  { url: '/museum_ultraman.html', series: 'ultraman', name_ja: '大怪獣シリーズ ウルトラマン' },
  { url: '/museum_ultraseven.html', series: 'ultraseven', name_ja: '大怪獣シリーズ ウルトラセブン' },
  { url: '/museum_return_of_ultraman.html', series: 'return-of-ultraman', name_ja: '大怪獣シリーズ 帰ってきたウルトラマン' },
  { url: '/museum_ultramana.html', series: 'ultraman-ace', name_ja: '大怪獣シリーズ ウルトラマンA' },
  { url: '/museum_ultramantaro.html', series: 'ultramantaro', name_ja: '大怪獣シリーズ ウルトラマンタロウ' },
  { url: '/museum_magmataisi.html', series: 'magmataisi', name_ja: '大怪獣シリーズ マグマ大使' },
  { url: '/museum_soutennenshoku.html', series: 'soutennenshoku', name_ja: '蒼天燃色' },
  { url: '/museum_sekai.html', series: 'sekai', name_ja: '世界の怪獣' },
  { url: '/museum_ultranewgeneration.html', series: 'ultranewgeneration', name_ja: 'ウルトラニュージェネレーション' },
  { url: '/museum_daiei20cm.html', series: 'daiei20cm', name_ja: '大映20cm' },
  { url: '/museum_p-pro.html', series: 'p-pro', name_ja: 'Pプロ' },
  { url: '/museum_boosuka.html', series: 'boosuka', name_ja: 'ブースカ' },
  { url: '/museum_toho20cm.html', series: 'toho20cm', name_ja: '東宝大怪獣20cm' },
  { url: '/museum_toho30cm.html', series: 'toho30cm', name_ja: '東宝30cm' },
  { url: '/museum_daiei30cm.html', series: 'daiei30cm', name_ja: '大映30cm' },
  { url: '/museum_ultra_realmastercollection.html', series: 'realmastercollection', name_ja: 'リアルマスターコレクション' },
  { url: '/museum_diecast_age.html', series: 'diecast-age', name_ja: 'ダイキャストエイジ' },
  { url: '/museum_ray_harryhausen.html', series: 'ray-harryhausen', name_ja: 'レイ・ハリーハウゼン' },
  { url: '/museum_youkaisinsiroku.html', series: 'youkaisinsiroku', name_ja: '妖怪四十八録' },
];

function fetch(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
    const req = https.get(fullUrl, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location, retries).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${fullUrl}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', async (e) => {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 500));
        fetch(url, retries - 1).then(resolve, reject);
      } else {
        reject(e);
      }
    });
    req.setTimeout(20000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

// 从详情页 HTML 判断模板类型
function detectType(html, url) {
  if (html.includes('item.css') || html.includes('lightbox.css')) return 'A';
  if (url.includes('/item_')) return 'B';
  return 'C';
}

// 提取 Type A (item.css div 布局) 的字段
function parseTypeA(html) {
  const item = {};

  // 商品名
  const titleM = html.match(/<div class="item_title">([^<]+)<\/div>/);
  if (titleM) item.product_name = titleM[1].trim();

  // 从 detail_box 提取字段对
  const detailBox = html.match(/<div class="detail_box">([\s\S]*?)<\/div>\s*(?:<div class="item_text2">|<!--)/);
  if (detailBox) {
    const pairs = detailBox[1].match(/<div class="detail_a">([^<]*)<\/div>\s*<div class="detail_b">([^<]*)<\/div>/g);
    if (pairs) {
      for (const p of pairs) {
        const lm = p.match(/detail_a">([^<]*)</);
        const vm = p.match(/detail_b">([^<]*)</);
        if (!lm || !vm) continue;
        const label = lm[1].replace(/[〈〉]/g, '').trim();
        const value = vm[1].trim();
        if (label.includes('サイズ') || label.includes('全高') || label.includes('全長')) item.height = value;
        else if (label.includes('材質')) item.material = value;
        else if (label.includes('仕様')) item.specs = value;
        else if (label.includes('パッケージ')) item.package_info = value;
        else if (label.includes('価格')) item.price = value;
        else if (label.includes('付属')) item.accessories = value;
      }
    }
  }

  // 图片：Type A 用 name="main_photo" 或 photo_box_main 定位主图，lightbox 链接为子图
  const mainImg = html.match(/<img[^>]*name="main_photo"[^>]*src="([^"]+)"/)
    || html.match(/<div class="photo_box_main">\s*<img[^>]*src="([^"]+)"/);
  const subImgs = [...html.matchAll(/<a\s[^>]*rel="lightbox\[[^\]]*\]"[^>]*>/g)]
    .map(m => { const hm = m[0].match(/href="([^"]+)"/); return hm ? hm[1] : null; })
    .filter(Boolean);
  const allImgs = [];
  if (mainImg) allImgs.push(mainImg[1]);
  for (const si of subImgs) if (!allImgs.includes(si)) allImgs.push(si);

  if (allImgs.length > 0) {
    item.image_url = allImgs[0].startsWith('http') ? allImgs[0] : `${BASE}${allImgs[0]}`;
  }
  if (allImgs.length > 1) {
    item.images = allImgs.map(u => u.startsWith('http') ? u : `${BASE}${u}`);
  } else if (item.image_url) {
    item.images = [item.image_url];
  }

  return item;
}

// 提取 spec table 的通用函数 (Type B 和 Type C)
function parseSpecTable(html) {
  const item = {};
  // 匹配 spec table: <table ... bgcolor="#336666"> 或 bgcolor=#336666
  const tableRe = /<table[^>]*bgcolor\s*=\s*["']?#336666["']?[^>]*>([\s\S]*?)<\/table>/gi;
  let match;
  while ((match = tableRe.exec(html)) !== null) {
    const rows = match[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!rows) continue;
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
      if (!cells || cells.length < 2) continue;
      const labelRaw = cells[0].replace(/<[^>]+>/g, '').replace(/[〈〉<>&lt;&gt;]/g, '').trim();
      const valueRaw = cells[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (!labelRaw || !valueRaw) continue;

      if (labelRaw.includes('商品名')) item.product_name = valueRaw;
      else if (labelRaw.includes('発売日')) item.release_date = valueRaw;
      else if (labelRaw.includes('材質')) item.material = valueRaw;
      else if (labelRaw.includes('仕様')) item.specs = valueRaw;
      else if (labelRaw.includes('全高') || labelRaw.includes('全長') || labelRaw.includes('サイズ')) item.height = valueRaw;
      else if (labelRaw.includes('パッケージ')) item.package_info = valueRaw;
      else if (labelRaw.includes('価格')) item.price = valueRaw;
      else if (labelRaw.includes('付属')) item.accessories = valueRaw;
      else if (labelRaw.includes('バリエーション')) item.variations = valueRaw;
    }
  }
  return item;
}

// 提取 Type B (rictext.css, /item_ URL) 的字段
function parseTypeB(html, url) {
  const item = parseSpecTable(html);

  // 如果没有从表里提取到商品名，从 <title> 取
  if (!item.product_name) {
    const tM = html.match(/<title>([^<]+)<\/title>/);
    if (tM) item.product_name = tM[1].replace(/^☆|☆$/g, '').trim();
  }

  // 图片：取所有较大的产品图（排除 header/totop/logo）
  const imgs = [...html.matchAll(/<img[^>]*src="(\/[^"]+\.(?:jpg|JPG|png|PNG|jpeg|JPEG))"/g)]
    .map(m => m[1])
    .filter(u => !/header|totop|logo|twitter|banner/.test(u));
  const uniqueImgs = [...new Set(imgs)];
  if (uniqueImgs.length > 0) {
    item.image_url = uniqueImgs[0].startsWith('http') ? uniqueImgs[0] : `${BASE}${uniqueImgs[0]}`;
    item.images = uniqueImgs.map(u => u.startsWith('http') ? u : `${BASE}${u}`);
  }

  return item;
}

// 提取 Type C (rictext.css, /museum URL) 的字段
function parseTypeC(html, url) {
  const item = parseSpecTable(html);

  // 如果表里没商品名，从第一个标题 table 取
  if (!item.product_name) {
    const titleM = html.match(/<td[^>]*class="text5"[^>]*>([\s\S]*?)<\/td>/);
    if (titleM) item.product_name = titleM[1].replace(/<[^>]+>/g, '').trim();
    if (!item.product_name) {
      const tM = html.match(/<title>([^<]+)<\/title>/);
      if (tM) item.product_name = tM[1].replace(/^☆|☆$/g, '').trim();
    }
  }

  // 图片：从 bgcolor="#000000" 的表格提取
  const imgTable = html.match(/<table[^>]*bgcolor\s*=\s*["']?#000000["']?[^>]*>([\s\S]*?)<\/table>/i);
  if (imgTable) {
    const imgs = [...imgTable[1].matchAll(/<img[^>]*src="(\/[^"]+\.(?:jpg|JPG|png|PNG|jpeg|JPEG))"/g)]
      .map(m => m[1]);
    if (imgs.length > 0) {
      item.image_url = imgs[0].startsWith('http') ? imgs[0] : `${BASE}${imgs[0]}`;
      item.images = imgs.map(u => u.startsWith('http') ? u : `${BASE}${u}`);
    }
  }
  // 如果没找到黑底表格，降级取所有图片
  if (!item.image_url) {
    const imgs = [...html.matchAll(/<img[^>]*src="(\/[^"]+\.(?:jpg|JPG|png|PNG|jpeg|JPEG))"/g)]
      .map(m => m[1])
      .filter(u => !/header|totop|logo|twitter|banner|top_title/.test(u));
    if (imgs.length > 0) {
      item.image_url = imgs[0].startsWith('http') ? imgs[0] : `${BASE}${imgs[0]}`;
      item.images = imgs.map(u => u.startsWith('http') ? u : `${BASE}${u}`);
    }
  }

  return item;
}

function decodeEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseDetailPage(html, url) {
  const type = detectType(html, url);
  let item;
  if (type === 'A') item = parseTypeA(html);
  else if (type === 'B') item = parseTypeB(html, url);
  else item = parseTypeC(html, url);

  item.source_type = type;
  item.detail_url = url.startsWith('http') ? url : `${BASE}${url}`;

  // 修复图片 URL 中的 HTML 实体
  if (item.image_url) item.image_url = decodeEntities(item.image_url);
  if (item.images) item.images = item.images.map(u => decodeEntities(u));

  // ref_id: 从 URL 提取文件名（去掉 .html）
  const fnMatch = url.match(/\/([^/]+)\.html$/);
  item.ref_id = fnMatch ? fnMatch[1] : url.replace(/[^a-zA-Z0-9_-]/g, '_');

  return item;
}

// 从系列页提取所有详情链接
function extractDetailUrls(html, seriesPageUrl) {
  const seen = new Set();
  const urls = [];

  // 匹配 item_thumbnail 里的链接
  const linkRe = /<a\s+href="([^"]+\.html)"/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    let href = m[1];
    // 排除非详情链接
    if (/museum\.html|top\.html|index\.html/.test(href)) continue;
    // 补全相对路径
    if (href.startsWith('/')) {
      href = `${BASE}${href}`;
    } else if (!href.startsWith('http')) {
      // 相对于系列页目录
      const base = seriesPageUrl.replace(/\/[^/]+\.html$/, '');
      href = `${base}/${href}`;
    }
    if (seen.has(href)) continue;
    seen.add(href);
    urls.push(href);
  }

  return urls;
}

// 从系列页提取系列名称
function extractSeriesTitle(html) {
  const titleM = html.match(/<div class="item_title">([^<]+)<\/div>/);
  if (titleM) return titleM[1].trim();
  const titleImg = html.match(/sereas_title"><img[^>]*alt="([^"]*)"/);
  if (titleImg) return titleImg[1].trim();
  return null;
}

// 完整爬取流程
async function scrapeAll(opts = {}) {
  const { concurrency = 4, onProgress = () => {} } = opts;

  // Step 1: 从每个系列页提取详情 URL
  const allTasks = [];
  for (const seriesInfo of SERIES_MAP) {
    try {
      const html = await fetch(seriesInfo.url);
      const title = extractSeriesTitle(html) || seriesInfo.name_ja;
      const detailUrls = extractDetailUrls(html, `${BASE}${seriesInfo.url}`);
      for (const url of detailUrls) {
        allTasks.push({ url, series: seriesInfo.series, series_name_ja: title });
      }
    } catch (e) {
      onProgress({ type: 'series_error', series: seriesInfo.series, error: e.message });
    }
  }

  const total = allTasks.length;
  const results = [];
  const errors = [];
  let done = 0;

  // Step 2: 并发抓取详情页
  const queue = allTasks.slice();
  async function worker() {
    while (queue.length) {
      const task = queue.shift();
      try {
        const html = await fetch(task.url);
        const item = parseDetailPage(html, task.url);
        item.series = task.series;
        item.series_name_ja = task.series_name_ja;
        results.push(item);
      } catch (e) {
        errors.push({ url: task.url, series: task.series, error: e.message });
      }
      done += 1;
      onProgress({ type: 'progress', done, total, results: results.length, errors: errors.length });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  return { items: results, errors, total };
}

// 写入数据库
const { extractCharacter } = require('./xplusCharacters');

async function refreshDatabase(db, opts = {}) {
  const { items, errors, total } = await scrapeAll(opts);

  db.update('DELETE FROM xplus_reference');

  let pos = 0;
  for (const it of items) {
    const charName = extractCharacter(it.product_name) || it.series_name_ja || it.ref_id;
    db.insert(
      `INSERT INTO xplus_reference (ref_id, series, series_name_ja, product_name, release_date, material, specs, height, price, package_info, accessories, variations, detail_url, image_url, images, source_type, position, character_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [it.ref_id, it.series, it.series_name_ja, it.product_name || null, it.release_date || null,
       it.material || null, it.specs || null, it.height || null, it.price || null,
       it.package_info || null, it.accessories || null, it.variations || null,
       it.detail_url, it.image_url || null, it.images ? JSON.stringify(it.images) : null, it.source_type, pos++, charName]
    );
  }

  return { count: items.length, errors, total };
}

module.exports = { scrapeAll, refreshDatabase, parseDetailPage, SERIES_MAP };
