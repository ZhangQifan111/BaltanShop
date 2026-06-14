(async () => {
  const jwt = prompt("Paste JWT:");
  if (!jwt) return;
  const H = { "accept": "application/json", "authorization": "Bearer " + jwt, "token": "0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1", "uid": "2016001" };
  const itemId = 39280200;

  var log = "";

  // Step 1: fetch detail
  log += "=== Step 1: fetch getDetails ===\n";
  var r = await fetch("https://rl.rngmoe.com/order/order/getDetails?service=item&itemId=" + itemId, { headers: H });
  log += "status: " + r.status + "\n";
  var d = JSON.parse(await r.text());
  log += "code: " + d.code + ", msg: " + d.msg + "\n";
  log += "has data: " + !!d.data + "\n\n";

  // Step 2: find feeInfo
  log += "=== Step 2: detailedInfo ===\n";
  var di = d.data.detailedInfo || [];
  log += "detailedInfo length: " + di.length + "\n";
  di.forEach(function(x, i) { log += "  [" + i + "] sign=" + x.sign + "\n"; });
  log += "\n";

  // Step 3: get fee block
  log += "=== Step 3: find feeInfo ===\n";
  var feeBlock = di.find(function(x) { return x.sign === "feeInfo"; });
  log += "found: " + !!feeBlock + "\n";
  if (feeBlock) {
    log += "feeBlock.data length: " + feeBlock.data.length + "\n";
    feeBlock.data.forEach(function(f) {
      log += "  title=" + f.title + " value=" + f.titleValue + "\n";
    });
  }
  log += "\n";

  // Step 4: parse
  log += "=== Step 4: parse fees ===\n";
  var feeInfo = (feeBlock || {}).data || [];
  var fees = { paymentFee:0, serviceFee:0, domesticShipping:0 };
  feeInfo.forEach(function(f) {
    var parts = (f.titleValue || "").split("日元");
    var num = parseInt(parts[0].replace(/[^0-9]/g, ""), 10) || 0;
    log += f.title + " -> raw=[" + f.titleValue + "] -> parts0=[" + parts[0] + "] -> num=" + num + "\n";
    if (f.title === "付款手续费") fees.paymentFee = num;
    if (f.title === "代购手续费") fees.serviceFee = num;
    if (f.title === "日本国内运费") fees.domesticShipping = num;
  });
  log += "FINAL: paymentFee=" + fees.paymentFee + " serviceFee=" + fees.serviceFee + " domesticShipping=" + fees.domesticShipping + "\n";

  var ta = document.createElement("textarea");
  ta.value = log;
  ta.style.cssText = "position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:#1e1e1e;color:#d4d4d4;font:12px monospace;padding:16px;border:2px solid #007acc;border-radius:8px;resize:none";
  ta.spellcheck = false;
  ta.onfocus = function(){ ta.select(); };
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
})();
