/*
 * ============================================================================
 * 任你购历史订单抓取脚本 v10
 * ============================================================================
 *
 * 用途：从 rennigou.jp 抓取全部已完成订单，逐条获取费用（日元+人民币）和包裹信息。
 *
 * ── 使用步骤 ──────────────────────────────────────────────────────────────
 * 1. 用手机/电脑浏览器打开 rennigou.jp 并登录
 * 2. 打开开发者工具（F12 或 菜单 → 开发者工具）
 * 3. 切换到 Console（控制台）标签页
 * 4. 复制本脚本的全部内容，粘贴到 Console 里，按回车运行
 * 5. 弹出对话框，JWT 已默认填入，过期再手动换新
 * 6. 等待脚本运行（标题栏会显示进度，约 2~3 分钟）
 * 7. 运行完成后弹出文本框，全选复制 JSON 数据
 * 8. 回到巴坦杂货铺设置页 → 任你购订单分析 → 粘贴 → 点「分析」
 *
 * ── JWT Token 获取方式 ────────────────────────────────────────────────────
 * 在已登录的 rennigou.jp 页面按 F12 打开开发者工具：
 *   - 切换到 Application（应用程序）标签页
 *   - 左侧 Storage → Local Storage → https://rl.rngmoe.com
 *   - 找到 key 为 "token" 的条目，复制其 value
 * 或者直接在 Console 输入：copy(localStorage.token)
 *
 * ── 输出字段 ──────────────────────────────────────────────────────────────
 * 商品级（body[] 内）：
 *   _paymentFee           — 付款手续费（日元）
 *   _paymentFeeRmb        — 付款手续费（人民币）
 *   _serviceFee           — 代购手续费（日元）
 *   _serviceFeeRmb        — 代购手续费（人民币）
 *   _domesticShipping     — 日本国内运费（日元）
 *   _domesticShippingRmb  — 日本国内运费（人民币）
 *   _coupon               — 优惠券抵扣（人民币）
 * 订单级（_package）：
 *   internationalShipping    — 国际运费（日元）
 *   internationalShippingRmb — 国际运费（人民币）
 *   packagingFee             — 包装手续费（日元）
 *   packagingFeeRmb          — 包装手续费（人民币）
 *   expressName / expressNo / weight
 * ============================================================================
 */
(async () => {
  const jwt = prompt("Paste JWT:", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJGUXdjd3RySHRtZHhRMGFDS2xRb3hOTXk5Z2xFcjRaZCIsImlhdCI6MTc4MTQzMTc1OC41NDcsImV4cCI6MTc4MTQzMTc4OC41NDd9.RghiWRqVq1I5tKNpPy7GlQpRQi2EXOgiHQ9fQEBFsNU");
  if (!jwt) return;
  const H = { "accept": "application/json", "authorization": "Bearer " + jwt, "token": "0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1", "uid": "2016001" };
  const BASE = "https://rl.rngmoe.com/order/order/";

  // Helper: parse JPY and RMB from titleValue like "750日元（约 34 元）"
  function parseFee(s) {
    var parts = (s || "").split("日元");
    var jpy = parseInt(parts[0].replace(/[^0-9]/g, ""), 10) || 0;
    var rmb = 0;
    if (parts.length > 1) rmb = parseInt(parts[1].replace(/[^0-9]/g, ""), 10) || 0;
    return [jpy, rmb];
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
            var pkg = { is:0, isRmb:0, pf:0, pfRmb:0, en:"", eno:"", wt:0 };

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

  // Step 5: merge item fees
  var merged = 0;
  for (var m = 0; m < orders.length; m++) {
    var bd = orders[m].body || [];
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

  var status = "v10: orders=" + orders.length + " itemFees=" + itemOk + "/" + itemIds.length + " packages=" + pkgOk + "/" + orderIds.length + " merged=" + merged + " pkgMerged=" + pkgMerged;
  document.title = status;

  var out = "=== " + status + " ===\n\n" + JSON.stringify(orders);
  var ta = document.createElement("textarea");
  ta.value = out;
  ta.style.cssText = "position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:#1e1e1e;color:#d4d4d4;font:12px monospace;padding:16px;border:2px solid #007acc;border-radius:8px;resize:none";
  ta.spellcheck = false;
  ta.onfocus = function(){ ta.select(); };
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
})();
