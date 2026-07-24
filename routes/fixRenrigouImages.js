/*
 * 任你购图片补抓 / 清理接口
 *
 * 场景：重装系统后 uploads/ 目录里的图片全没了，但 toys 表的 image 字段还指向
 *       /uploads/renrigou_xxx.jpg；同时 database 还有 image_url 字段存着原始远程 URL
 *       （importRenrigou 入库时会一起存），可以用它重新下载回来。
 *
 * 路由：
 *   POST /api/fix-renrigou-images          预览 / 执行（SSE 流式）
 *   POST /api/fix-renrigou-images/cleanup  清理指向不存在文件的 image 字段
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db/database');
const { fetchAndSaveImage, localFileExists, runWithConcurrency } = require('../utils/downloadImage');

const ORDERS_DIR = path.join(__dirname, '..', 'data', 'orders');

// 扫所有"图片应该存在但实际丢失"的 toys 记录
async function scanMissing() {
  const rows = await db.all(
    "SELECT id, name, image, image_url FROM toys WHERE image LIKE '/uploads/%' OR image LIKE 'uploads/%'"
  );
  const missing = [];
  for (const r of rows) {
    if (!localFileExists(r.image)) {
      missing.push(r);
    }
  }
  return { totalChecked: rows.length, missing };
}

// 分类：能补（有 image_url 且看起来没过期）/ 不能补（无 url / url 明显过期）
function classify(missing) {
  const fixable = [];
  const unfixable = [];
  for (const m of missing) {
    if (!m.image_url) {
      unfixable.push({ ...m, reason: 'no_image_url', reasonLabel: '没有存原始远程 URL' });
      continue;
    }
    // 任你购代理 URL 通常带 ?s= 或 ?_= 参数，可能是签名过期线索
    // Yahoo/Mercdn 原始 URL 也有 ?_= 时间戳，过期迹象：1年以上或空 query
    const looksExpired = (
      !/\?/.test(m.image_url) ||
      /\?_=\d{10,}/.test(m.image_url) && (Date.now() / 1000 - parseInt((m.image_url.match(/\?_=(\d+)/) || [])[1] || 0, 10)) > 365 * 86400
    );
    if (looksExpired) {
      unfixable.push({ ...m, reason: 'url_likely_expired', reasonLabel: '远程 URL 大概率过期（带 1 年以上时间戳）' });
    } else {
      fixable.push({ ...m });
    }
  }
  return { fixable, unfixable };
}

// 预览（不下手）
router.post('/', async (req, res) => {
  try {
    const { dryRun } = req.body || {};
    if (dryRun === false) {
      // 执行模式 → 走下面 runWithSSE
      return runWithSSE(req, res);
    }

    const { totalChecked, missing } = await scanMissing();
    const { fixable, unfixable } = classify(missing);
    res.json({
      totalChecked,
      missingCount: missing.length,
      fixableCount: fixable.length,
      unfixableCount: unfixable.length,
      fixable: fixable.map(f => ({ id: f.id, name: f.name, item_id: (f.name.match(/(\d{6,})/) || [])[1] || null, image_url: f.image_url })),
      unfixable: unfixable.map(u => ({ id: u.id, name: u.name, image_url: u.image_url, reason: u.reason, reasonLabel: u.reasonLabel }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 执行补抓（SSE 流式）
async function runWithSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { totalChecked, missing } = await scanMissing();
    const { fixable, unfixable } = classify(missing);

    send('start', { totalChecked, missingCount: missing.length, fixableCount: fixable.length, unfixableCount: unfixable.length });

    // 跳过不能补的，直接报
    for (const u of unfixable) {
      send('skip', { id: u.id, name: u.name, reason: u.reason, reasonLabel: u.reasonLabel });
    }

    let ok = 0, fail = 0;
    const concurrency = 15;

    // 信号量并发：始终保持 15 个在飞，快的补位快的（手写 batch 会让慢图阻塞整批下一批进不来）
    await runWithConcurrency(fixable, concurrency, async (item) => {
      const itemId = (item.name.match(/(\d{6,})/) || [])[1] || String(item.id);
      send('progress', { id: item.id, name: item.name, status: 'fetching' });
      const result = await fetchAndSaveImage(item.image_url, itemId);
      if (result.ok) {
        db.update('UPDATE toys SET image = ?, image_fetched_at = ? WHERE id = ?',
          [result.localPath, new Date().toISOString(), item.id]);
        ok++;
        send('item_done', { id: item.id, name: item.name, status: 'ok', localPath: result.localPath, attempts: result.attempts });
      } else {
        // 失败：image 清空，保留 image_url 留作日后重试
        db.update('UPDATE toys SET image = ? WHERE id = ?', [null, item.id]);
        fail++;
        send('item_done', { id: item.id, name: item.name, status: 'fail', reason: result.reason, attempts: result.attempts });
      }
    });

    send('done', { total: fixable.length, ok, fail });
    res.end();
  } catch (e) {
    send('error', { message: e.message });
    res.end();
  }
}

// 清理：把所有 image 指向本地但文件不存在的记录，image 字段置空（保留 image_url）
router.post('/cleanup', async (req, res) => {
  try {
    const { missing } = await scanMissing();
    let cleaned = 0;
    for (const m of missing) {
      db.update('UPDATE toys SET image = NULL WHERE id = ?', [m.id]);
      cleaned++;
    }
    res.json({ ok: true, cleaned, totalMissing: missing.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/*
 * 从「最新一次任你购抓取文件」给缺图老订单补图（SSE 流式）
 *
 * 场景：重装系统后老订单只剩商单信息、image_url 也没存，普通补图（靠库里 image_url）
 *       完全用不了。改为读 data/orders/ 里最新抓取的 orders-*.json，从 body[].product_main_img
 *       拿到图片 URL，按 item_id 匹配库里已存在但本地图片丢失的 toys，重新下载并把 image_url
 *       一起存回（以后再重装可直接补，不用再抓）。
 *
 * 前提：先在 rennigou.jp 跑一次 fetch_all_details.js（已改成翻到底），把老订单也抓进来。
 */
function latestOrdersFile() {
  if (!fs.existsSync(ORDERS_DIR)) return null;
  const files = fs.readdirSync(ORDERS_DIR).filter(f => /^orders-.*\.json$/.test(f));
  if (!files.length) return null;
  files.sort(); // 文件名是 ISO 时间戳，字典序即时间序
  return path.join(ORDERS_DIR, files[files.length - 1]);
}

// 从抓取文件里抽 item_id -> 图片URL
// 兼容两种抓取脚本的格式：
//   旧 fetch_all_details.js — [{body: [{item_id, product_main_img}]}]   嵌套订单结构
//   新 fetch.js             — [{item_id, name, image_url, notes}, ...]   平铺商品数组
function buildImageMap(parsed) {
  const orders = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.orders) ? parsed.orders : []);
  const map = new Map();
  for (const ord of orders) {
    const items = Array.isArray(ord && ord.body) ? ord.body
                : (ord && ord.item_id ? [ord]   // 本身就是一条商品（新 fetch.js 平铺格式）
                : []);
    for (const it of items) {
      const id = String((it && it.item_id) || '');
      const url = (it && (it.product_main_img || it.image_url)) || '';
      if (id && url && !map.has(id)) map.set(id, url);
    }
  }
  return map;
}

router.post('/from-scrape', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const file = latestOrdersFile();
    if (!file) {
      send('error', { message: '没找到任你购抓取数据。请先在 rennigou.jp 跑一次抓取脚本，再来补图。' });
      return res.end();
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      send('error', { message: '抓取数据文件解析失败：' + e.message });
      return res.end();
    }

    const imgMap = buildImageMap(parsed);

    // 只挑「库里已存在 + 本地图片确实丢了 + 这次抓取里有图片URL」的老订单
    const targets = [];
    for (const [itemId, url] of imgMap) {
      const toy = await db.get(
        "SELECT id, name, image FROM toys WHERE notes LIKE ? LIMIT 1",
        ['%renrigou_item_id:' + itemId + '%']
      );
      if (!toy) continue;                    // 抓到的是新订单/库里没有 → 交给正常导入
      if (localFileExists(toy.image)) continue; // 本地已有图 → 不用补
      targets.push({ id: toy.id, name: toy.name, itemId, url });
    }

    send('start', {
      scannedFile: path.basename(file),
      scrapedItems: imgMap.size,
      total: targets.length
    });

    let ok = 0, fail = 0;
    const concurrency = 15;

    // 信号量并发（forceRedownload 走默认 false — from-scrape 是补缺场景，已存在的文件跳过）
    await runWithConcurrency(targets, concurrency, async (t) => {
      send('progress', { id: t.id, name: t.name, status: 'fetching' });
      const result = await fetchAndSaveImage(t.url, t.itemId);
      if (result.ok) {
        db.update('UPDATE toys SET image = ?, image_url = ?, image_fetched_at = ? WHERE id = ?',
          [result.localPath, t.url, new Date().toISOString(), t.id]);
        ok++;
        send('item_done', { id: t.id, name: t.name, status: 'ok', localPath: result.localPath, attempts: result.attempts });
      } else {
        // 下载失败（多半是源站图已删）：只把 image_url 存回留作日后重试，image 字段不动
        db.update('UPDATE toys SET image_url = ? WHERE id = ?', [t.url, t.id]);
        fail++;
        send('item_done', { id: t.id, name: t.name, status: 'fail', reason: result.reason, attempts: result.attempts });
      }
    });

    send('done', { total: targets.length, ok, fail, scrapedItems: imgMap.size });
    res.end();
  } catch (e) {
    send('error', { message: e.message });
    res.end();
  }
});

module.exports = router;
