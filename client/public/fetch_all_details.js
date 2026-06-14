// v6 - simplified: flat loop, no recursion, explicit error tracking
(async () => {
  const jwt = prompt("Paste JWT:");
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

  // Step 2: item ids
  var itemIds = [];
  for (var j = 0; j < orders.length; j++) {
    var body = orders[j].body || [];
    for (var k = 0; k < body.length; k++) {
      var id = body[k].item_id;
      if (itemIds.indexOf(id) === -1) itemIds.push(id);
    }
  }

  // Step 3: fetch fees in batches of 20
  var results = {};
  var ok = 0, fail = 0;
  var idx = 0;
  while (idx < itemIds.length) {
    // collect batch of up to 20
    var batch = [];
    while (batch.length < 20 && idx < itemIds.length) {
      batch.push(itemIds[idx]); idx++;
    }
    // fire all in parallel
    var promises = [];
    for (var b = 0; b < batch.length; b++) {
      var itemId = batch[b];
      promises.push((async function(id) {
        try {
          var r2 = await fetch(BASE + "getDetails?service=item&itemId=" + id, { headers: H });
          var d2 = JSON.parse(await r2.text());
          if (d2.code === 0 && d2.data) {
            var di = d2.data.detailedInfo || [];
            var feeBlock = null;
            for (var dii = 0; dii < di.length; dii++) { if (di[dii].sign === "feeInfo") { feeBlock = di[dii]; break; } }
            if (feeBlock && feeBlock.data) {
              var fees = { pf:0, sf:0, ds:0 };
              for (var fi = 0; fi < feeBlock.data.length; fi++) {
                var f = feeBlock.data[fi];
                var parts = (f.titleValue || "").split("日元");
                var num = parseInt(parts[0].replace(/[^0-9]/g, ""), 10) || 0;
                if (f.title === "付款手续费") fees.pf = num;
                else if (f.title === "代购手续费") fees.sf = num;
                else if (f.title === "日本国内运费") fees.ds = num;
              }
              results[id] = fees;
              ok++;
              return;
            }
          }
        } catch(e) {}
        fail++;
      })(itemId));
    }
    await Promise.all(promises);
    document.title = "done " + (idx) + "/" + itemIds.length + " ok=" + ok + " fail=" + fail;
  }

  // Step 4: merge
  var merged = 0;
  for (var m = 0; m < orders.length; m++) {
    var bd = orders[m].body || [];
    for (var n = 0; n < bd.length; n++) {
      var f = results[bd[n].item_id];
      if (f) {
        bd[n]._paymentFee = f.pf;
        bd[n]._serviceFee = f.sf;
        bd[n]._domesticShipping = f.ds;
        merged++;
      }
    }
  }

  var status = "v6: orders=" + orders.length + " items=" + itemIds.length + " feesOk=" + ok + " fail=" + fail + " merged=" + merged;
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
