// debug: 查看 detailedInfo 全部区块（找优惠券等隐藏字段）
(async () => {
  const jwt = prompt("Paste JWT:");
  if (!jwt) return;
  const H = { "accept": "application/json", "authorization": "Bearer " + jwt, "token": "0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1", "uid": "2016001" };
  const itemId = prompt("Item ID (留空用默认 39280200):") || "39280200";

  var log = "=== itemId=" + itemId + " ===\n\n";
  var r = await fetch("https://rl.rngmoe.com/order/order/getDetails?service=item&itemId=" + itemId, { headers: H });
  var d = JSON.parse(await r.text());
  log += "API code: " + d.code + "\n\n";

  var di = d.data.detailedInfo || [];
  log += "detailedInfo 共 " + di.length + " 个区块:\n";
  log += "────────────────────────────────────────────\n";

  di.forEach(function(block, i) {
    log += "\n[" + i + "] sign=" + block.sign + "  data条数=" + (block.data ? block.data.length : 0) + "\n";
    if (block.sign !== "itemState") {
      // 打印该区块的完整 data 内容
      if (block.data && block.data.length) {
        block.data.forEach(function(row, j) {
          if (typeof row === "object") {
            log += "  [" + j + "] " + JSON.stringify(row) + "\n";
          } else {
            log += "  [" + j + "] " + row + "\n";
          }
        });
      }
    } else {
      // itemState 只打印条数
      log += "  (状态时间线，共" + (block.data ? block.data.length : 0) + "条)\n";
    }
  });

  log += "\n────────────────────────────────────────────\n";
  log += "如果有优惠券相关字段，会出现在上面的非 itemState 区块中。\n";

  var ta = document.createElement("textarea");
  ta.value = log;
  ta.style.cssText = "position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:#1e1e1e;color:#d4d4d4;font:12px monospace;padding:16px;border:2px solid #007acc;border-radius:8px;resize:none";
  ta.spellcheck = false;
  ta.onfocus = function(){ ta.select(); };
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
})();
