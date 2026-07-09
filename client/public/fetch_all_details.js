/*
 * ============================================================================
 * 任你购历史订单抓取脚本 v14
 * ============================================================================
 *
 * 用途：在已登录的 rennigou.jp 浏览器 Console 跑一次，自动抓全部已完成订单，
 *       把数据 POST 给本地巴坦后端（POST /api/ingest-renrigou），并自动跳回
 *       巴坦「任你购订单分析」页面，订单分析会自动加载最新文件。
 *
 * ── 使用步骤（一次性）───────────────────────────────────────────────────────
 * 1. 在「设置 → 任你购自动抓取」下方点「📋 复制抓取脚本」，把脚本存到剪贴板
 *    也可以直接收藏这个 URL 为浏览器书签（拖下面这行到收藏栏）：
 *      javascript:void(0)  （首次先复制脚本，粘贴到 Console 跑一遍即可）
 * 2. 打开 rennigou.jp，登录
 * 3. 按 F12 开 Console，粘贴脚本 + Enter
 * 4. 等 30~60 秒，看到页面自动跳到 localhost:3000/renrigou 即完成
 *
 * 任意一次需要再抓，重复步骤 2~4 即可
 * ============================================================================
 */
(async () => {
  // 从 SPA 已登录态读 token：先解析 userInfo JSON 取 .token，再扫所有 storage
  // 任你购的 token 形态是 64 字符 hex（不是 JWT）
  function pickToken() {
    function looksLikeToken(v) {
      if (!v) return false;
      // 任你购：64 字符 hex
      if (/^[a-f0-9]{32,128}$/i.test(v)) return true;
      // JWT 形态
      if (/^eyJ[A-Za-z0-9_-]+\.eyJ/.test(v)) return true;
      return false;
    }
    // 0. 优先解析 userInfo JSON
    try {
      var ui = localStorage.getItem("userInfo");
      if (ui) {
        var parsed = JSON.parse(ui);
        if (parsed && parsed.token && looksLikeToken(parsed.token)) {
          return { token: parsed.token, uid: parsed.user_id, where: "userInfo.token" };
        }
      }
    } catch (e) {}
    // 1. localStorage.token
    var t = localStorage.getItem("token");
    if (looksLikeToken(t)) return { token: t, where: "localStorage.token" };
    // 2. localStorage 里扫所有 key
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      var v = localStorage.getItem(k);
      if (looksLikeToken(v)) return { token: v, where: "localStorage." + k };
    }
    // 3. sessionStorage 扫
    for (var j = 0; j < sessionStorage.length; j++) {
      var sk = sessionStorage.key(j);
      if (!sk) continue;
      var sv = sessionStorage.getItem(sk);
      if (looksLikeToken(sv)) return { token: sv, where: "sessionStorage." + sk };
    }
    // 4. cookie
    var m = document.cookie.match(/(?:token|access_token|jwt|authorization)\s*=\s*([^;]+)/i);
    if (m && looksLikeToken(decodeURIComponent(m[1]))) return { token: decodeURIComponent(m[1]), where: "cookie" };
    return null;
  }
  const found = pickToken();
  if (!found) {
    showDiagnostic();
    return;
  }
  const token = found.token;
  const uid = found.uid || "2016001";
  console.log("[rng] token picked from " + found.where + " (len=" + token.length + ")" + (found.uid ? " uid=" + found.uid : ""));
  const H = { "accept": "application/json", "token": token, "uid": String(uid) };
  const BASE = "https://rl.rngmoe.com/order/order/";
  const BATAN = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? `http://${location.hostname}:3000`
    : "http://localhost:3000";

  // Helper: parse JPY and RMB from titleValue like "750日元（约 34 元）"
  function parseFee(s) {
    var parts = (s || "").split("日元");
    var jpy = parseInt(parts[0].replace(/[^0-9]/g, ""), 10) || 0;
    var rmb = 0;
    if (parts.length > 1) rmb = parseInt(parts[1].replace(/[^0-9]/g, ""), 10) || 0;
    return [jpy, rmb];
  }

  // 诊断页：把 localStorage / sessionStorage / cookie 全部列出来，方便用户复制贴给我
  function showDiagnostic() {
    var lines = [];
    lines.push("=== DOMAIN ===");
    lines.push("location.hostname: " + location.hostname);
    lines.push("location.href: " + location.href);
    lines.push("");
    lines.push("=== localStorage (" + localStorage.length + " keys) ===");
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      var v = localStorage.getItem(k);
      var truncated = v.length > 200 ? v.slice(0, 200) + "...[共 " + v.length + " 字符]" : v;
      lines.push("[" + k + "] = " + truncated);
    }
    lines.push("");
    lines.push("=== sessionStorage (" + sessionStorage.length + " keys) ===");
    for (var j = 0; j < sessionStorage.length; j++) {
      var sk = sessionStorage.key(j);
      var sv = sessionStorage.getItem(sk);
      var strunc = sv.length > 200 ? sv.slice(0, 200) + "...[共 " + sv.length + " 字符]" : sv;
      lines.push("[" + sk + "] = " + strunc);
    }
    lines.push("");
    lines.push("=== document.cookie ===");
    lines.push(document.cookie || "(空)");
    var text = lines.join("\n");

    // 复制到剪贴板（手机可能失败，但桌面 99% 成功）
    function tryCopy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
    var copied = tryCopy();

    // 在页面顶部插一个可读、可复制的 banner
    var banner = document.createElement("div");
    banner.id = "rng-diagnostic-banner";
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#000;color:#d4d4d4;font:13px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',monospace;padding:14px;overflow:auto";
    banner.innerHTML = [
      '<div style="background:#2a1010;border:2px solid #c33;padding:12px;border-radius:8px;margin-bottom:12px">',
      '  <div style="color:#ff6666;font-weight:bold;font-size:15px;margin-bottom:6px">⚠️ 未找到 JWT（点掉弹窗也无所谓，这条横幅一直在这里）</div>',
      '  <div style="font-size:12px;color:#aaa;margin-bottom:8px">可能原因：(1) 还没登录 (2) 当前不是 SPA 渲染页 (3) 任你购换了存储方式</div>',
      copied
        ? '<div style="color:#7eff7e;font-size:12px;margin-bottom:6px">✅ 诊断信息已自动复制到剪贴板 → 直接粘贴发给我</div>'
        : '<div style="color:#ffd966;font-size:12px;margin-bottom:6px">自动复制失败，请长按下方文本手动全选复制</div>',
      '  <button id="rng-copy-btn" style="background:#06f;color:#fff;border:0;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer;margin-right:8px">📋 再复制一次</button>',
      '  <button id="rng-close-btn" style="background:#444;color:#fff;border:0;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer">关闭</button>',
      '</div>',
      '<pre id="rng-diagnostic-pre" style="background:#1e1e1e;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;font-size:11px;line-height:1.5;user-select:text;-webkit-user-select:text">' + escapeHtml(text) + '</pre>'
    ].join("\n");
    document.body.appendChild(banner);
    document.getElementById("rng-copy-btn").onclick = function () {
      var ok2 = tryCopy();
      this.textContent = ok2 ? "✅ 已复制" : "❌ 复制失败，请长按文本手动选";
    };
    document.getElementById("rng-close-btn").onclick = function () {
      banner.remove();
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Step 1: fetch list
  var orders = [];
  for (var p = 1; p <= 7; p++) {
    document.title = "list " + p + "/7";
    var r1 = await fetch(BASE + "getLists?page=" + p + "&page_last_id=0&service=finish_ownerPackage&is_show_page=1", { headers: H });
    var d1 = await r1.json();
    if (d1.data && d1.data.result) { var list = d1.data.result; for (var i = 0; i < list.length; i++) orders.push(list[i]); }
  }

  // Step 2: item ids + order ids
  var itemIds = [];
  var orderIds = [];
  for (var j = 0; j < orders.length; j++) {
    orderIds.push(orders[j].id);
    var body = orders[j].body || [];
    for (var k = 0; k < body.length; k++) {
      var id = body[k].item_id;
      if (itemIds.indexOf(id) === -1) itemIds.push(id);
    }
  }

  // Step 3: fetch item fees in batches of 20
  var itemResults = {};
  var itemOk = 0, itemFail = 0;
  var idx = 0;
  while (idx < itemIds.length) {
    var batch = [];
    while (batch.length < 20 && idx < itemIds.length) {
      batch.push(itemIds[idx]); idx++;
    }
    var promises = [];
    for (var b = 0; b < batch.length; b++) {
      var itemId = batch[b];
      promises.push((async function(id) {
        try {
          var r = await fetch(BASE + "getDetails?service=item&itemId=" + id, { headers: H });
          var d = JSON.parse(await r.text());
          if (d.code === 0 && d.data) {
            var di = d.data.detailedInfo || [];
            var feeBlock = null;
            for (var dii = 0; dii < di.length; dii++) { if (di[dii].sign === "feeInfo") { feeBlock = di[dii]; break; } }
            if (feeBlock && feeBlock.data) {
              var fees = { pf:0, pfRmb:0, sf:0, sfRmb:0, ds:0, dsRmb:0, coupon:0 };
              for (var fi = 0; fi < feeBlock.data.length; fi++) {
                var f = feeBlock.data[fi];
                if (f.title === "付款手续费") { var pr = parseFee(f.titleValue); fees.pf = pr[0]; fees.pfRmb = pr[1]; }
                else if (f.title === "代购手续费") { var pr = parseFee(f.titleValue); fees.sf = pr[0]; fees.sfRmb = pr[1]; }
                else if (f.title === "日本国内运费") { var pr = parseFee(f.titleValue); fees.ds = pr[0]; fees.dsRmb = pr[1]; }
                else if (f.title === "优惠券抵扣") {
                  var cparts = (f.titleValue || "").split("元");
                  fees.coupon = parseInt(cparts[0].replace(/[^0-9\-]/g, ""), 10) || 0;
                }
              }
              itemResults[id] = fees;
              itemOk++;
              return;
            }
          }
        } catch(e) {}
        itemFail++;
      })(itemId));
    }
    await Promise.all(promises);
    document.title = "items " + idx + "/" + itemIds.length + " ok=" + itemOk + " fail=" + itemFail;
  }

  // Step 4: fetch package data for each unique order (batch 20)
  var packageResults = {};
  var pkgOk = 0, pkgFail = 0;
  var idx2 = 0;
  while (idx2 < orderIds.length) {
    var batch = [];
    while (batch.length < 20 && idx2 < orderIds.length) {
      batch.push(orderIds[idx2]); idx2++;
    }
    var promises = [];
    for (var b = 0; b < batch.length; b++) {
      var orderId = batch[b];
      promises.push((async function(oid) {
        try {
          var r = await fetch(BASE + "getDetails?service=package&itemId=" + oid, { headers: H });
          var d = JSON.parse(await r.text());
          if (d.code === 0 && d.data) {
            var pkg = { is:0, isRmb:0, pf:0, pfRmb:0, en:"", eno:"", wt:0, itemPrices:{} };

            // extract product RMB prices
            var prods = d.data.product || [];
            for (var pi = 0; pi < prods.length; pi++) {
              if (prods[pi].itemId && prods[pi].unitPriceRmb) {
                pkg.itemPrices[prods[pi].itemId] = prods[pi].unitPriceRmb;
              }
            }

            var di = d.data.detailedInfo || [];
            var feeBlock = null;
            for (var dii = 0; dii < di.length; dii++) { if (di[dii].sign === "feeInfo") { feeBlock = di[dii]; break; } }
            if (feeBlock && feeBlock.data) {
              for (var fi = 0; fi < feeBlock.data.length; fi++) {
                var f = feeBlock.data[fi];
                if (f.title === "国际运费") { var pr = parseFee(f.titleValue); pkg.is = pr[0]; pkg.isRmb = pr[1]; }
                else if (f.title === "包装手续费") { var pr = parseFee(f.titleValue); pkg.pf = pr[0]; pkg.pfRmb = pr[1]; }
              }
            }

            var ei = d.data.expressInfo;
            if (ei) {
              pkg.en = ei.express_name || "";
              pkg.eno = ei.express_no || "";
              pkg.wt = ei.ship_real_weight || 0;
            }

            packageResults[oid] = pkg;
            pkgOk++;
            return;
          }
        } catch(e) {}
        pkgFail++;
      })(orderId));
    }
    await Promise.all(promises);
    document.title = "packages " + idx2 + "/" + orderIds.length + " ok=" + pkgOk + " fail=" + pkgFail;
  }

  // Step 5: merge item fees + product prices
  var merged = 0;
  var priceMerged = 0;
  for (var m = 0; m < orders.length; m++) {
    var bd = orders[m].body || [];
    var pkgItemPrices = (packageResults[orders[m].id] || {}).itemPrices || {};
    for (var n = 0; n < bd.length; n++) {
      var f = itemResults[bd[n].item_id];
      if (f) {
        bd[n]._paymentFee = f.pf;
        bd[n]._paymentFeeRmb = f.pfRmb;
        bd[n]._serviceFee = f.sf;
        bd[n]._serviceFeeRmb = f.sfRmb;
        bd[n]._domesticShipping = f.ds;
        bd[n]._domesticShippingRmb = f.dsRmb;
        bd[n]._coupon = f.coupon;
        merged++;
      }
      // merge product RMB price from package data
      if (pkgItemPrices[bd[n].item_id]) {
        bd[n]._priceRmb = pkgItemPrices[bd[n].item_id];
        priceMerged++;
      } else if (!bd[n]._priceRmb) {
        bd[n]._priceRmb = 0;
      }
    }
  }

  // Step 6: merge package data
  var pkgMerged = 0;
  for (var oi = 0; oi < orders.length; oi++) {
    var p = packageResults[orders[oi].id];
    if (p) {
      orders[oi]._package = {
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

  var status = "v12: orders=" + orders.length + " itemFees=" + itemOk + "/" + itemIds.length + " packages=" + pkgOk + "/" + orderIds.length + " merged=" + merged + " pkgMerged=" + pkgMerged + " priceRmb=" + priceMerged;
  document.title = status;

  // 把抓到的数据 POST 给本地巴坦后端；失败时落入剪贴板 + 旧式 textarea
  var out = "=== " + status + " ===\n\n" + JSON.stringify(orders);

  function showFallback(reason) {
    // 把 JSON 也保留不带 status 前缀的纯数组版本（巴坦粘贴框只需要数组）
    var pureJson = JSON.stringify(orders);

    // 1) 尝试自动复制（兼容多端）
    var copyStatus = "未复制";
    function tryCopyAll() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(pureJson).then(function () {
            copyStatus = "已复制纯 JSON 数组";
            refreshStatus();
          }).catch(function () { tryExecCopy(); });
        } else { tryExecCopy(); }
      } catch (e) { tryExecCopy(); }
    }
    function tryExecCopy() {
      try {
        var ta = document.createElement("textarea");
        ta.value = pureJson;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        copyStatus = ok ? "已复制纯 JSON 数组（旧 API）" : "自动复制失败，请手动长按下面文本框选复制";
        refreshStatus();
      } catch (e) {
        copyStatus = "自动复制失败，请手动长按下面文本框选复制";
        refreshStatus();
      }
    }

    // 2) 全屏 banner + 可读 JSON 文本框
    var banner = document.createElement("div");
    banner.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0a0a0a;color:#e0e0e0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;padding:16px;overflow:auto;display:flex;flex-direction:column;gap:12px";
    banner.innerHTML = [
      '<div style="background:#3a1010;border:2px solid #c33;padding:14px;border-radius:8px;flex-shrink:0">',
      '  <div style="display:flex;align-items:flex-start;gap:10px">',
      '    <div style="flex:1">',
      '      <div style="color:#ff7a7a;font-weight:bold;font-size:18px;margin-bottom:8px">⚠️ 抓取成功，但无法自动发送到巴坦</div>',
      '      <div style="font-size:13px;color:#bbb;margin-bottom:10px">原因：' + escapeHtml(reason) + '</div>',
      '      <div style="font-size:13px;color:#7eff7e;margin-bottom:12px" id="rng-copy-status">正在尝试复制 JSON 到剪贴板…</div>',
      '    </div>',
      '    <button id="rng-close-x" style="background:transparent;color:#aaa;border:1px solid #555;width:36px;height:36px;border-radius:6px;font-size:20px;cursor:pointer;flex-shrink:0;line-height:1" title="关闭（ESC）">✕</button>',
      '  </div>',
      '  <div style="display:flex;flex-wrap:wrap;gap:8px">',
      '    <button id="rng-copy-btn" style="background:#06f;color:#fff;border:0;padding:12px 18px;border-radius:6px;font-size:15px;font-weight:bold;cursor:pointer">📋 复制 JSON</button>',
      '    <button id="rng-download-btn" style="background:#2a8;color:#fff;border:0;padding:12px 18px;border-radius:6px;font-size:15px;font-weight:bold;cursor:pointer">⬇️ 下载 .json 文件</button>',
      '    <a href="http://localhost:3000/renrigou" target="_blank" style="background:#444;color:#fff;border:0;padding:12px 18px;border-radius:6px;font-size:15px;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-block">🪟 打开巴坦（新窗口）</a>',
      '  </div>',
      '</div>',
      '<div style="background:#1e1e1e;padding:10px;border-radius:6px;flex-shrink:0;font-size:12px;color:#999">',
      '  📌 长按下面文本框 → 全选 → 复制（手机必用此法）',
      '</div>',
      '<textarea id="rng-json-area" readonly style="flex:1;min-height:200px;background:#000;color:#0f0;font:12px/1.4 monospace;padding:12px;border:1px solid #333;border-radius:6px;resize:none;white-space:pre;overflow:auto;user-select:text;-webkit-user-select:text;width:100%;box-sizing:border-box">' + escapeHtml(pureJson) + '</textarea>'
    ].join("\n");
    document.body.appendChild(banner);
    document.body.style.overflow = "hidden";

    function closeBanner() {
      banner.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
    }
    function onEsc(e) { if (e.key === "Escape") closeBanner(); }
    document.getElementById("rng-close-x").onclick = closeBanner;
    document.addEventListener("keydown", onEsc);

    var statusEl = document.getElementById("rng-copy-status");
    function refreshStatus() { if (statusEl) statusEl.textContent = copyStatus; }

    document.getElementById("rng-copy-btn").onclick = function () {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(pureJson).then(function () {
            copyStatus = "✅ 已复制（" + pureJson.length + " 字符）";
            refreshStatus();
          });
        } else { tryExecCopy(); }
      } catch (e) { tryExecCopy(); }
    };

    document.getElementById("rng-download-btn").onclick = function () {
      try {
        var blob = new Blob([pureJson], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "renrigou-orders-" + Date.now() + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        copyStatus = "✅ 已触发下载，去文件管理器或下载目录找 renrigou-orders-xxx.json";
        refreshStatus();
      } catch (e) {
        copyStatus = "❌ 下载失败：" + e.message;
        refreshStatus();
      }
    };

    // 自动尝试一次
    setTimeout(tryCopyAll, 100);
  }

  try {
    var resp = await fetch(BATAN + "/api/ingest-renrigou", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: orders, status: status })
    });
    var json = await resp.json();
    if (json && json.ok) {
      // 成功后直接跳到巴坦任你购分析页（带 auto=1 让前端识别）
      window.location.href = BATAN + "/renrigou?auto=" + Date.now();
      return;
    } else {
      showFallback("巴坦后端拒绝数据 (" + (json && json.error || "未知") + ")");
    }
  } catch (e) {
    showFallback("无法连通巴坦后端 (" + e.message + ")");
  }
})();
