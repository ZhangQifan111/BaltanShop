const https = require('https');
const express = require('express');
const router = express.Router();

// 翻译缓存：同一句话不重复翻译
const cache = new Map();

function translateOne(text) {
  return new Promise((resolve) => {
    if (!text || !text.trim()) return resolve('');
    const cached = cache.get(text);
    if (cached !== undefined) return resolve(cached);

    const url = 'https://simplytranslate.org/api/translate?engine=google&from=ja&to=zh&text=' + encodeURIComponent(text);
    const req = https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          const t = (j.translated_text || '').trim();
          cache.set(text, t);
          resolve(t);
        } catch { cache.set(text, ''); resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.setTimeout(10000, () => { req.destroy(); resolve(''); });
  });
}

router.post('/', async (req, res) => {
  const { texts } = req.body || {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.json({ translations: [] });
  }

  const BATCH = 10;
  const translations = new Array(texts.length).fill('');

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(t => translateOne(t)));
    for (let j = 0; j < results.length; j++) {
      translations[i + j] = results[j];
    }
  }

  res.json({ translations });
});

module.exports = router;
