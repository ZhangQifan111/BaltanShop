(async () => {
  const jwt = prompt("Paste JWT token (fresh!):");
  if (!jwt) return alert("no token");

  const raw = prompt("Paste the 138 orders JSON array:");
  if (!raw) return alert("no data");

  var cleaned = raw.replace(/^\s*\/\/[^\n\r]*/gm, "").replace(/,(\s*[}\]])/g, "$1");
  var orders;
  try { orders = JSON.parse(cleaned); } catch(e) { return alert("JSON error: " + e.message); }

  var itemIds = [];
  orders.forEach(function(ord) {
    (ord.body || []).forEach(function(it) {
      if (itemIds.indexOf(it.item_id) === -1) itemIds.push(it.item_id);
    });
  });

  if (!confirm("Found " + itemIds.length + " items. Start fetching fees? (keep JWT fresh!)")) return;

  var H = { "accept": "application/json", "authorization": "Bearer " + jwt, "token": "0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1", "uid": "2016001" };
  var BASE = "https://rl.rngmoe.com/order/order/";

  function parseFee(val) {
    if (!val) return 0;
    var parts = val.split("日元");
    var num = parseInt(parts[0].replace(/[^0-9]/g, ""), 10);
    return num || 0;
  }

  var done = 0; var results = {}; var okCount = 0;
  function showProgress() { document.title = done + "/" + itemIds.length; }

  var idx = 0;
  async function processBatch() {
    var batch = [];
    while (idx < itemIds.length && batch.length < 20) {
      var itemId = itemIds[idx]; idx++;
      batch.push((async function() {
        try {
          var r2 = await fetch(BASE + "getDetails?service=item&itemId=" + itemId, { headers: H });
          var d = JSON.parse(await r2.text());
          if (d.code === 0 && d.data) {
            var fees = { paymentFee:0, serviceFee:0, domesticShipping:0 };
            var feeBlock = (d.data.detailedInfo || []).find(function(x) { return x.sign === "feeInfo"; });
            var feeInfo = (feeBlock || {}).data || [];
            feeInfo.forEach(function(f) {
              if (f.title === "付款手续费") fees.paymentFee = parseFee(f.titleValue);
              if (f.title === "代购手续费") fees.serviceFee = parseFee(f.titleValue);
              if (f.title === "日本国内运费") fees.domesticShipping = parseFee(f.titleValue);
            });
            results[itemId] = fees;
            okCount++;
          }
        } catch(e) {}
        done++; showProgress();
      })());
    }
    if (batch.length > 0) { await Promise.all(batch); if (idx < itemIds.length) await processBatch(); }
  }
  await processBatch();

  orders.forEach(function(ord) {
    (ord.body || []).forEach(function(it) {
      var fees = results[it.item_id];
      if (fees) { it._paymentFee = fees.paymentFee; it._serviceFee = fees.serviceFee; it._domesticShipping = fees.domesticShipping; }
    });
  });

  var out = JSON.stringify(orders);
  var ta = document.createElement("textarea");
  ta.value = out;
  ta.style.cssText = "position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:#1e1e1e;color:#d4d4d4;font:12px monospace;padding:16px;border:2px solid #007acc;border-radius:8px;resize:none";
  ta.spellcheck = false;
  ta.onfocus = function(){ ta.select(); };
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.title = "Fees done: " + okCount + "/" + itemIds.length;
})();
