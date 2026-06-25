(async () => {
  const jwt = prompt("粘贴 JWT token（Network -> getLists -> Copy as fetch -> Bearer 后面的整段）:");
  if (!jwt) return alert("没输入 token，取消");
  const H = { "accept": "application/json", "authorization": "Bearer " + jwt, "token": "0fe0f7d6f0fc2c1f79fe53992a189c2d032a0cfd6c3560a4402f4ac715e376a1", "uid": "2016001" };
  const all = [];
  for (let p = 1; p <= 7; p++) {
    const r = await fetch("https://rl.rngmoe.com/order/order/getLists?page=" + p + "&page_last_id=0&service=finish_ownerPackage&is_show_page=1", { headers: H });
    const d = await r.json();
    all.push(...d.data.result);
  }
  const json = JSON.stringify(all);
  console.log("共 " + all.length + " 条");

  // 在当前页面弹出结果框，方便复制
  const ta = document.createElement("textarea");
  ta.value = json;
  ta.style.cssText = "position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:#1e1e1e;color:#d4d4d4;font:12px monospace;padding:16px;border:2px solid #007acc;border-radius:8px;resize:none";
  ta.spellcheck = false;
  ta.onfocus = () => ta.select();
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
})();
