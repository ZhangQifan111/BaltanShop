/*
 * 任你购抓取路由（残留路径 - 当前不使用）
 *
 * 主流程已切换到：用户在已登录的 rennigou.jp 浏览器 Console 跑升级版
 * fetch_all_details.js，脚本自动 POST 数据到 /api/ingest-renrigou。
 *
 * 本路由保留只为：万一前端还在引用、或临时手动测试时可用：
 *   POST /api/fetch-renrigou { jwt }   → SSE 流式抓取（30s 过期 token 快速路径）
 *
 * 没有 puppeteer 自动登录：rennigou 部署了盾 SDK 阻挡 headless chrome。
 */
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data', 'orders');

function fetchJson(url, { headers = {}, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location, { headers, timeout }).then(resolve, reject);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('JSON parse failed: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
  });
}

function parseFee(s) {
  var parts = (s || '').split('日元');
  var jpy = parseInt(parts[0].replace(/[^0-9]/g, ''), 10) || 0;
  var rmb = 0;
  if (parts.length > 1) {
    rmb = parseInt(parts[1].replace(/[^0-9]/g, ''), 10) || 0;
    if (!rmb && jpy > 0) rmb = jpy;
  } else if (jpy > 0) {
    rmb = jpy;
  }
  return [jpy, rmb];
}

async function batchFetch(items, batchSize, fn, onProgress) {
  const results = {};
  let ok = 0, fail = 0, idx = 0;
  while (idx < items.length) {
    const batch = items.slice(idx, idx + batchSize);
    const promises = batch.map(async (id) => {
      try {
        results[id] = await fn(id);
        ok++;
      } catch(e) { fail++; }
    });
    await Promise.all(promises);
    idx += batch.length;
    if (onProgress) onProgress({ ok, fail, done: idx, total: items.length });
    if (idx < items.length) await new Promise(r => setTimeout(r, 200));
  }
  return { results, ok, fail };
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

router.post('/', async (req, res) => {
  return res.status(410).json({
    error: '此接口已弃用。请在 rennigou.jp 已登录页面的浏览器 Console 跑 /fetch_all_details.js（点巴坦「任你购订单分析」页的「📋 复制抓取脚本」按钮获取），脚本会自动 POST 到 /api/ingest-renrigou'
  });
});

module.exports = router;
