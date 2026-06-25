// 探路 v4: 寻找包裹 API 的正确路径
(async () => {
  const jwt = prompt("Paste JWT:");
  if (!jwt) return;
  const H = { "accept": "application/json", "authorization": "Bearer " + jwt, "token": "0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1", "uid": "2016001" };

  // 获取列表，拿到第一个订单
  const BASE = "https://rl.rngmoe.com/order/order/";
  var r1 = await fetch(BASE + "getLists?page=1&page_last_id=0&service=finish_ownerPackage&is_show_page=1", { headers: H });
  var d1 = await r1.json();
  var order = (d1.data && d1.data.result && d1.data.result[0]) || {};
  var orderId = order.id;
  // 检查 item 里有没有 pid 等字段
  var item = (order.body && order.body[0]) || {};
  var pid = item.pid;

  var log = "=== orderId=" + orderId + " pid=" + pid + " item_id=" + item.item_id + " ===\n\n";

  // 尝试不同 base 路径
  var bases = [
    "https://rl.rngmoe.com/order/order/",
    "https://rl.rngmoe.com/order/package/",
    "https://rl.rngmoe.com/package/order/",
    "https://rl.rngmoe.com/package/package/",
    "https://rl.rngmoe.com/user/package/",
  ];

  var paths = [
    "getDetails?service=package&itemId=" + orderId,
    "getDetails?service=package&packageId=" + orderId,
    "getDetails?service=package&orderId=" + orderId,
    "getDetails?service=item&itemId=" + orderId + "&page_type=package",
    "getPackageDetail?orderId=" + orderId,
    "getPackageDetail?packageId=" + orderId,
    "getPackageInfo?orderId=" + orderId,
    "getPackageInfo?packageId=" + orderId,
    "getExpress?orderId=" + orderId,
    "expressInfo?orderId=" + orderId,
  ];

  // 用主 base 测试所有路径
  for (var p = 0; p < paths.length; p++) {
    var url = BASE + paths[p];
    try {
      var r = await fetch(url, { headers: H });
      var txt = await r.text();
      var d;
      try { d = JSON.parse(txt); } catch(e) {}
      var code = d ? d.code : "?";
      if (code === 0) {
        log += "✅ " + paths[p] + "\n";
        log += "   data keys: " + Object.keys(d.data||{}).join(", ") + "\n";
        log += "   page_type: " + ((d.data||{}).page_type||"?") + "\n";
      } else {
        log += "❌ " + paths[p] + " code=" + code + " msg=" + (d ? d.msg : "") + "\n";
      }
    } catch(e) {
      log += "🔥 " + paths[p] + " ex=" + e.message + "\n";
    }
  }

  var ta = document.createElement("textarea");
  ta.value = log;
  ta.style.cssText = "position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:#1e1e1e;color:#d4d4d4;font:12px monospace;padding:16px;border:2px solid #007acc;border-radius:8px;resize:none";
  ta.spellcheck = false;
  ta.onfocus = function(){ ta.select(); };
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
})();
