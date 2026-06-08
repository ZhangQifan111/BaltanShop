const https = require('https');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const BASE = 'https://www.ultrakaijyu.com';

// 不需要抓的页面
const SKIP_SLUGS = new Set([
  'ultramanlist', 'returnofultramanlist', 'ultrasevenlist', 'ultramanacelist',
  'ultramanleolist', 'ultramantarolist', 'ultraman80list', 'ultraqlist', 'otherslist',
  'ultrafightlist', 'corner813560list', 'treatiselist',
  'index', 'archive', 'new-product', 'Treatise',
  // 上述是系列/栏目页(无玩具列表);下面曾经误判为"系列主页"也 skip 掉,
  // 实际上是各系列英雄(主角本人)的玩具页,后来发现 /ultraman/ultraman.html 等
  // 是有玩具的,这些 slug 不再 skip。ultraq 是纪录片无英雄,others 也不固定。
  'ultrafight', 'corner813560', 'Treatise',
]);

function fetch(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
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

// 从 sitemap 拿 (series, slug) 对
async function listCharactersFromSitemap(seriesFilter = null) {
  const xml = await fetch(`${BASE}/sitemap.xml`);
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  const seen = new Set();
  const result = [];
  for (const url of urls) {
    const m = url.match(/ultrakaijyu\.com\/([^/]+)\/([^/]+)\.html$/);
    if (!m) continue;
    const series = m[1];
    const slug = m[2];
    if (seriesFilter && series !== seriesFilter) continue;
    if (SKIP_SLUGS.has(slug)) continue;
    const key = `${series}/${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ series, slug });
  }
  return result;
}

// 解析角色页的 td 块
// 形如: <td class="cmc set-1"> <p class="ac"><span class="img"><a href="../_src/.../big.png"><img src="../_src/.../thumb.png"></a></span><br>ベムラー01<br>ブルマァク</p> </td>
function parseCharacterPage(html, series, characterSlug) {
  // 优先从 <title>X of ウルトラ怪獣.com</title> 提取日文名
  // 形如 <title>ゴモラ of ウルトラ怪獣.com</title> → "ゴモラ"
  let characterNameJa = null;
  const titleMatch = html.match(/<title>([^<]+?)\s+of\s+ウルトラ怪獣\.com<\/title>/);
  if (titleMatch) characterNameJa = titleMatch[1].trim();

  const tds = html.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
  const items = [];
  const seen = new Set();
  for (const td of tds) {
    // 提取名字+编号和厂牌：<br>NAME<br>BRAND
    const m = td.match(/<br>\s*([^<>]+?)\s*<br>\s*([^<>]+?)\s*<\/p>/);
    if (!m) continue;
    const nameWithNum = m[1].trim();
    const brand = m[2].trim();
    // 提取编号（末尾 2 位数字）
    const numMatch = nameWithNum.match(/(\d{2})\s*$/);
    if (!numMatch) continue;
    const num = numMatch[1];
    const refId = `${characterSlug}-${num}`;
    if (seen.has(refId)) continue;
    seen.add(refId);
    // 如果 title 提取失败, fallback 到玩具标签去尾数字 (旧逻辑)
    if (!characterNameJa) characterNameJa = nameWithNum.replace(/\d+\s*$/, '').trim();

    // 缩略图: <img src="../_src/.../thumb.png" width="100" height="147">
    const thumbMatch = td.match(/<img\s+src="(\.\.\/_src\/[^"]+\.png[^"]*)"/);
    // 大图: <a href="../_src/.../big.png" class="bindzoom">
    const bigMatch = td.match(/<a\s+href="(\.\.\/_src\/[^"]+\.png[^"]*)"/);
    const imageUrl = thumbMatch ? `${BASE}${thumbMatch[1].replace(/^\.\.\//, '/')}` : null;
    const imageBigUrl = bigMatch ? `${BASE}${bigMatch[1].replace(/^\.\.\//, '/')}` : null;

    items.push({
      ref_id: refId,
      generation: seriesToGen(series),
      source: brand,
      brand,
      detail_url: `${BASE}/${series}/${characterSlug}.html`,
      image_url: imageUrl,
      image_big_url: imageBigUrl,
      series,
      character_slug: characterSlug,
      character_name_ja: characterNameJa,
      position: items.length,
    });
  }
  return items;
}

function seriesToGen(series) {
  const map = {
    'ultraman': 1, 'return-of-ultraman': 2, 'ultraseven': 3,
    'ultraman-ace': 4, 'ultraman-leo': 5, 'ultramantaro': 6,
    'ultraman80': 7, 'ultraq': 8, 'others': 9,
  };
  return map[series] || 0;
}

// 单页抓取 + 解析
async function scrapeCharacter(series, slug) {
  const url = `${BASE}/${series}/${slug}.html`;
  const html = await fetch(url);
  return parseCharacterPage(html, series, slug);
}

// 并发抓所有角色
async function scrapeAll(opts = {}) {
  const { series: seriesFilter = null, concurrency = 4, onProgress = () => {} } = opts;
  const chars = await listCharactersFromSitemap(seriesFilter);
  const results = [];
  const errors = [];
  let done = 0;
  const queue = chars.slice();
  async function worker() {
    while (queue.length) {
      const { series, slug } = queue.shift();
      try {
        const items = await scrapeCharacter(series, slug);
        results.push(...items);
      } catch (e) {
        errors.push({ series, slug, error: e.message });
      }
      done += 1;
      if (done % 5 === 0 || done === chars.length) {
        onProgress(done, chars.length);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { items: results, errors, total: chars.length };
}

async function refreshDatabase(db, opts = {}) {
  const { items, errors, total } = await scrapeAll(opts);
  if (opts.series) {
    // 系列模式：只删该系列
    db.update('DELETE FROM baltan_reference WHERE series = ?', [opts.series]);
  } else {
    // 全量模式：清空
    db.update('DELETE FROM baltan_reference');
  }
  for (const it of items) {
    db.insert(
      'INSERT INTO baltan_reference (ref_id, generation, source, brand, detail_url, image_url, image_big_url, position, series, character_slug, character_name_ja) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [it.ref_id, it.generation, it.source, it.brand, it.detail_url, it.image_url, it.image_big_url, it.position, it.series, it.character_slug, it.character_name_ja]
    );
  }
  return { count: items.length, errors, total };
}

module.exports = { scrapeAll, scrapeCharacter, listCharactersFromSitemap, parseCharacterPage, refreshDatabase };
