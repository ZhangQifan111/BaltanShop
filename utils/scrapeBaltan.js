const https = require('https');

const SOURCES = [
  {
    generation: 1,
    url: 'https://ultrakaijyu.com/ultraman/alienbaltan.html',
    refIdPattern: /バルタン星人(\d{2})/,
    tdPattern: /バルタン星人(\d{2})<br>([^<]+)</
  },
  {
    generation: 2,
    url: 'https://ultrakaijyu.com/ultraman/alienbaltan2.html',
    refIdPattern: /バルタン星人[（(]二代目[)）](\d{2})/,
    tdPattern: /バルタン星人[（(]二代目[)）](\d{2})<br>([^<]+)</
  }
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
  });
}

function parseItems(html, generation) {
  const refIdPattern = generation === 1
    ? /バルタン星人(\d{2})/
    : /バルタン星人[（(]二代目[)）](\d{2})/;
  const tdPattern = generation === 1
    ? /バルタン星人(\d{2})<br>([^<]+)</
    : /バルタン星人[（(]二代目[)）](\d{2})<br>([^<]+)</;
  const tds = html.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
  const items = [];
  const seen = new Set();
  let position = 0;
  for (const td of tds) {
    const m = td.match(tdPattern);
    if (!m) continue;
    const refId = m[1];
    if (seen.has(refId)) continue;
    seen.add(refId);
    const source = m[2].trim();
    // 缩略图: <img src="../_src/.../XXX.png?v=...">
    const thumbMatch = td.match(/<img src="(\.\.\/_src\/[^"]+)"/);
    // 大图: <a href="../_src/.../XXX.png?v=...">
    const bigMatch = td.match(/<a href="(\.\.\/_src\/[^"]+\.png[^"]*)"/);
    const imageUrl = thumbMatch ? `https://ultrakaijyu.com${thumbMatch[1].replace(/^\.\.\//, '/')}` : null;
    const imageBigUrl = bigMatch ? `https://ultrakaijyu.com${bigMatch[1].replace(/^\.\.\//, '/')}` : null;
    items.push({
      ref_id: refId,
      generation,
      source,
      detail_url: generation === 1
        ? 'https://ultrakaijyu.com/ultraman/alienbaltan.html'
        : 'https://ultrakaijyu.com/ultraman/alienbaltan2.html',
      image_url: imageUrl,
      image_big_url: imageBigUrl,
      position: position++
    });
  }
  return items;
}

async function scrapeAll() {
  const all = [];
  for (const src of SOURCES) {
    const html = await fetch(src.url);
    const items = parseItems(html, src.generation);
    all.push(...items);
  }
  return all;
}

async function refreshDatabase(db) {
  const items = await scrapeAll();
  db.update('DELETE FROM baltan_reference');
  for (const it of items) {
    db.insert(
      'INSERT INTO baltan_reference (ref_id, generation, source, detail_url, image_url, image_big_url, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [it.ref_id, it.generation, it.source, it.detail_url, it.image_url, it.image_big_url, it.position]
    );
  }
  return items.length;
}

module.exports = { scrapeAll, parseItems, refreshDatabase };
