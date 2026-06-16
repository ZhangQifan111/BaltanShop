const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data', 'orders');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

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
    // "246日元" 后面没有数字 → 前面的数字就是 RMB
    if (!rmb && jpy > 0) rmb = jpy;
  } else if (jpy > 0) {
    // 没有"日元"分隔符 → 直接是 RMB
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

router.post('/', async (req, res) => {
  const { jwt } = req.body || {};
  if (!jwt) return res.status(400).json({ error: 'missing jwt' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const send = (data) => {
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  };

  req.setTimeout(120000);
  req.on('timeout', () => {
    send({ phase: 'error', message: '抓取超时（超过 2 分钟）' });
    res.end();
  });

  try {
    const H = {
      'accept': 'application/json',
      'authorization': 'Bearer ' + jwt,
      'token': '0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1',
      'uid': '2016001'
    };
    const BASE = 'https://rl.rngmoe.com/order/order/';

    // Step 1: fetch 7 pages
    const orders = [];
    for (let p = 1; p <= 7; p++) {
      send({ phase: 'list', current: p, total: 7 });
      try {
        const r = await fetchJson(BASE + 'getLists?page=' + p + '&page_last_id=0&service=finish_ownerPackage&is_show_page=1', { headers: H, timeout: 15000 });
        if (r.data && r.data.result) orders.push(...r.data.result);
      } catch(e) {}
    }

    if (orders.length === 0) {
      send({ phase: 'error', message: '未获取到订单数据，可能 JWT 已过期' });
      return res.end();
    }

    // Step 2: extract IDs
    const itemIds = [];
    const orderIds = [];
    const seenItems = new Set();
    for (const ord of orders) {
      orderIds.push(ord.id);
      for (const it of (ord.body || [])) {
        if (!seenItems.has(it.item_id)) {
          seenItems.add(it.item_id);
          itemIds.push(it.item_id);
        }
      }
    }

    // Step 3: fetch item fees (低并发 + 延时避免限流)
    const { results: itemFees, ok: itemOk, fail: itemFail } = await batchFetch(
      itemIds, 5,
      async (id) => {
        const r = await fetchJson(BASE + 'getDetails?service=item&itemId=' + id, { headers: H, timeout: 15000 });
        if (r.code !== 0 || !r.data) throw new Error('bad response');
        const di = r.data.detailedInfo || [];
        const feeBlock = di.find(b => b.sign === 'feeInfo');
        const fees = { pf: 0, pfRmb: 0, sf: 0, sfRmb: 0, ds: 0, dsRmb: 0, coupon: 0, itemPriceRmb: 0 };
        if (feeBlock && feeBlock.data) {
          for (const f of feeBlock.data) {
            if (f.title === '付款手续费') { var pr = parseFee(f.titleValue); fees.pf = pr[0]; fees.pfRmb = pr[1]; }
            else if (f.title === '代购手续费') { var pr = parseFee(f.titleValue); fees.sf = pr[0]; fees.sfRmb = pr[1]; }
            else if (f.title === '日本国内运费') { var pr = parseFee(f.titleValue); fees.ds = pr[0]; fees.dsRmb = pr[1]; }
            else if (f.title === '商品费用') { var pr = parseFee(f.titleValue); fees.itemPriceRmb = pr[1]; }
            else if (f.title === '优惠券抵扣') {
              var cparts = (f.titleValue || '').split('元');
              fees.coupon = parseInt(cparts[0].replace(/[^0-9\-]/g, ''), 10) || 0;
            }
          }
        }
        return fees;
      },
      (p) => send({ phase: 'items', ...p })
    );

    // Step 4: fetch package data (低并发 + 延时避免限流)
    const { results: packages, ok: pkgOk, fail: pkgFail } = await batchFetch(
      orderIds, 5,
      async (oid) => {
        const r = await fetchJson(BASE + 'getDetails?service=package&itemId=' + oid, { headers: H, timeout: 15000 });
        if (r.code !== 0 || !r.data) throw new Error('bad response');
        const pkg = { is: 0, isRmb: 0, pf: 0, pfRmb: 0, en: '', eno: '', wt: 0, itemPrices: {} };

        const prods = r.data.product || [];
        for (const p of prods) {
          if (p.itemId && p.unitPriceRmb) pkg.itemPrices[p.itemId] = p.unitPriceRmb;
        }

        const di = r.data.detailedInfo || [];
        const feeBlock = di.find(b => b.sign === 'feeInfo');
        if (feeBlock && feeBlock.data) {
          for (const f of feeBlock.data) {
            if (f.title === '国际运费') { var pr = parseFee(f.titleValue); pkg.is = pr[0]; pkg.isRmb = pr[1]; }
            else if (f.title === '包装手续费') { var pr = parseFee(f.titleValue); pkg.pf = pr[0]; pkg.pfRmb = pr[1]; }
          }
        }

        const ei = r.data.expressInfo;
        if (ei) {
          pkg.en = ei.express_name || '';
          pkg.eno = ei.express_no || '';
          pkg.wt = ei.ship_real_weight || 0;
        }

        return pkg;
      },
      (p) => send({ phase: 'packages', ...p })
    );

    // Step 5: merge
    let merged = 0, priceMerged = 0, pkgMerged = 0;
    for (const ord of orders) {
      const pkgItemPrices = (packages[ord.id] || {}).itemPrices || {};
      for (const it of (ord.body || [])) {
        const f = itemFees[it.item_id];
        if (f) {
          it._paymentFee = f.pf;
          it._paymentFeeRmb = f.pfRmb;
          it._serviceFee = f.sf;
          it._serviceFeeRmb = f.sfRmb;
          it._domesticShipping = f.ds;
          it._domesticShippingRmb = f.dsRmb;
          it._coupon = f.coupon;
          merged++;
          // 用 item 详情里的商品费用（购买时真实付款 RMB），比 package 的 unitPriceRmb（当前汇率）更准
          if (f.itemPriceRmb > 0) {
            it._priceRmb = f.itemPriceRmb;
          }
        }
        if (!it._priceRmb && pkgItemPrices[it.item_id]) {
          it._priceRmb = pkgItemPrices[it.item_id];
          priceMerged++;
        } else if (!it._priceRmb) {
          it._priceRmb = 0;
        }
      }
      const p = packages[ord.id];
      if (p) {
        ord._package = {
          internationalShipping: p.is,
          internationalShippingRmb: p.isRmb,
          packagingFee: p.pf,
          packagingFeeRmb: p.pfRmb,
          expressName: p.en,
          expressNo: p.eno,
          weight: p.wt
        };
        pkgMerged++;
      }
    }

    // Step 6: save
    ensureDir();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = 'orders-' + ts + '.json';
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(orders));

    send({
      phase: 'done',
      orderCount: orders.length,
      itemCount: itemIds.length,
      itemOk, itemFail,
      pkgOk, pkgFail,
      merged, priceMerged, pkgMerged,
      savedFile: filename,
      data: orders
    });

  } catch(e) {
    send({ phase: 'error', message: e.message || '未知错误' });
  }
  res.end();
});

module.exports = router;
