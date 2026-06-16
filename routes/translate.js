const https = require('https');
const express = require('express');
const router = express.Router();

function translateOne(text) {
  return new Promise((resolve) => {
    if (!text || !text.trim()) return resolve('');
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=ja|zh-CN';
    const req = https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve(j.responseData?.translatedText?.trim() || '');
        } catch { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.setTimeout(8000, () => { req.destroy(); resolve(''); });
  });
}

router.post('/', async (req, res) => {
  const { texts } = req.body || {};
  if (!Array.isArray(texts) || texts.length === 0) {
    return res.json({ translations: [] });
  }

  const BATCH = 3;
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
