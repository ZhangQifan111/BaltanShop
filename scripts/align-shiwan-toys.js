/**
 * 把 3 个食玩相关池（id=11/15/18）里玩具的 category 改成各自池的 category
 * 让仓库"系列"分组对齐到食玩子分类。
 *
 * 用法（在终端跑）：
 *   node scripts/align-shiwan-toys.js
 *
 * 跑完需重启服务器让内存 db 重新读盘。
 */

const { getDb, all: q, run: r } = require('../db/database');

const POOL_IDS = [11, 15, 18]; // 无盒21世纪扭蛋 / 带盒掌动 / 带盒21世纪扭蛋

(async () => {
  await getDb();

  console.log('━━━ BEFORE ━━━');
  for (const pid of POOL_IDS) {
    const pool = await q('SELECT id, name_zh, name, category FROM products WHERE id = ?', [pid]);
    if (!pool.length) continue;
    const toys = await q('SELECT id, name_zh, category FROM toys WHERE product_id = ?', [pid]);
    console.log('池 id=' + pid + ' (' + (pool[0].name_zh || pool[0].name) + ') 池 category=' + pool[0].category);
    toys.forEach(t => console.log('  [' + t.category + '] ' + t.name_zh));
  }

  console.log('\n━━━ 改 category 对齐 ━━━');
  let totalChanged = 0;
  for (const pid of POOL_IDS) {
    const pool = await q('SELECT category FROM products WHERE id = ?', [pid]);
    if (!pool.length) continue;
    const poolCat = pool[0].category;
    // 只改 category != poolCat 的（已经对齐的不动）
    const result = await r('UPDATE toys SET category = ? WHERE product_id = ? AND category != ?', [poolCat, pid, poolCat]);
    console.log('池 id=' + pid + ' → 池 category=' + poolCat + '（已改完）');
    totalChanged++;
  }

  console.log('\n━━━ AFTER ━━━');
  for (const pid of POOL_IDS) {
    const pool = await q('SELECT name_zh, name, category FROM products WHERE id = ?', [pid]);
    if (!pool.length) continue;
    const toys = await q('SELECT id, category, name_zh FROM toys WHERE product_id = ?', [pid]);
    console.log('池 id=' + pid + ' (' + (pool[0].name_zh || pool[0].name) + ')');
    toys.forEach(t => console.log('  [' + t.category + '] ' + t.name_zh));
  }

  console.log('\n✓ 处理了', totalChanged, '个池。请重启服务器：pkill -9 -f "node.*server.js" && PORT=7685 nohup node server.js > /tmp/server.log 2>&1 &');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
