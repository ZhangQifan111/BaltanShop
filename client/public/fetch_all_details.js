/*
 * ============================================================================
 * 任你购历史订单抓取脚本 v9
 * ============================================================================
 *
 * 用途：从 rennigou.jp 抓取全部已完成订单，逐条获取每件商品的费用（代购手续费、
 *       日本国内运费、付款手续费、优惠券），并获取每单包裹信息（国际运费、
 *       包装手续费、快递方式、运单号、重量）。
 *
 * ── 使用步骤 ──────────────────────────────────────────────────────────────
 * 1. 用手机/电脑浏览器打开 rennigou.jp 并登录
 * 2. 打开开发者工具（F12 或 菜单 → 开发者工具）
 * 3. 切换到 Console（控制台）标签页
 * 4. 复制本脚本的全部内容，粘贴到 Console 里，按回车运行
 * 5. 弹出对话框，粘贴你当前页面的 JWT Token（见下方获取方式）
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
 * 然后粘贴到脚本弹出的对话框里。
 *
 * ── 抓取范围 ──────────────────────────────────────────────────────────────
 * 仅抓取"已完成"状态的订单（service=finish_ownerPackage），共 7 页约 138 单。
 * 每件商品和每单包裹各发一次详情请求，20 条并发。
 *
 * ── 输出字段 ──────────────────────────────────────────────────────────────
 * 商品级（body[] 内）：
 *   _paymentFee         — 付款手续费（日元）
 *   _serviceFee         — 代购手续费（日元）
 *   _domesticShipping   — 日本国内运费（日元）
 *   _coupon             — 优惠券抵扣（元，负数为抵扣金额）
 * 订单级（_package）：
 *   internationalShipping — 国际运费（日元）
 *   packagingFee          — 包装手续费（日元）
 *   expressName           — 快递方式
 *   expressNo             — 运单号
 *   weight                — 实际重量（克，可能为0表示未记录）
 * ============================================================================
 */
(async () => {
  const jwt = prompt("Paste JWT:", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJGUXdjd3RySHRtZHhRMGFDS2xRb3hOTXk5Z2xFcjRaZCIsImlhdCI6MTc4MTQzMTc1OC41NDcsImV4cCI6MTc4MTQzMTc4OC41NDd9.RghiWRqVq1I5tKNpPy7GlQpRQi2EXOgiHQ9fQEBFsNU");
  if (!jwt) return;
  const H = { "accept": "application/json", "authorization": "Bearer " + jwt, "token": "0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1", "uid": "2016001" };
  const BASE = "https://rl.rngmoe.com/order/order/";

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
              var fees = { pf:0, sf:0, ds:0, coupon:0 };
              for (var fi = 0; fi < feeBlock.data.length; fi++) {
                var f = feeBlock.data[fi];
                var parts = (f.titleValue || "").split("日元");
                var num = parseInt(parts[0].replace(/[^0-9]/g, ""), 10) || 0;
                if (f.title === "付款手续费") fees.pf = num;
                else if (f.title === "代购手续费") fees.sf = num;
                else if (f.title === "日本国内运费") fees.ds = num;
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
            var pkg = { is:0, pf:0, en:"", eno:"", wt:0 };

            // extract feeInfo: 国际运费 / 包装手续费
            var di = d.data.detailedInfo || [];
            var feeBlock = null;
            for (var dii = 0; dii < di.length; dii++) { if (di[dii].sign === "feeInfo") { feeBlock = di[dii]; break; } }
            if (feeBlock && feeBlock.data) {
              for (var fi = 0; fi < feeBlock.data.length; fi++) {
                var f = feeBlock.data[fi];
                var parts = (f.titleValue || "").split("日元");
                var num = parseInt(parts[0].replace(/[^0-9]/g, ""), 10) || 0;
                if (f.title === "国际运费") pkg.is = num;
                else if (f.title === "包装手续费") pkg.pf = num;
              }
            }

            // extract expressInfo
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
        bd[n]._serviceFee = f.sf;
        bd[n]._domesticShipping = f.ds;
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
        packagingFee: p.pf,
        expressName: p.en,
        expressNo: p.eno,
        weight: p.wt
      };
      pkgMerged++;
    }
  }

  var status = "v8: orders=" + orders.length + " itemFees=" + itemOk + "/" + itemIds.length + " packages=" + pkgOk + "/" + orderIds.length + " merged=" + merged + " pkgMerged=" + pkgMerged;
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
