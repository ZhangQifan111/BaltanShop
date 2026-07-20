/**
 * 一次性扫描老数据，把 products/toys 身上写过的 category 字符串
 * 但分类表里没登记的全部自动补登为顶级分类。
 *
 * 用法（在终端跑）：
 *   node scripts/ensure-all-categories.js
 *
 * 跑完会打印：
 *   - 扫到的孤儿 category 列表
 *   - 自动补登了哪些
 *   - 数据库里最终分类数量
 *
 * 注意：脚本通过后端 API 走认证，但补登走直接 SQL（因为是一次性数据迁移）。
 * 改完后需重启服务器才能让内存里的 db 重新读盘。
 */

const { getDb, all: q, insert: i } = require('../db/database');

(async () => {
  await getDb();

  console.log('━━━ BEFORE ━━━');
  const catsBefore = await q('SELECT COUNT(*) as n FROM categories');
  console.log('分类总数:', catsBefore[0].n);

  // 1. 收集 products 里出现过的 category
  const prodCats = await q('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""');
  // 2. 收集 toys 里出现过的 category
  const toyCats = await q('SELECT DISTINCT category FROM toys WHERE category IS NOT NULL AND category != ""');
  // 3. 收集分类表里现有的所有 name
  const existCats = await q('SELECT name FROM categories');
  const existSet = new Set(existCats.map(c => c.name));

  // 4. 合并 + 去重
  const allUsed = new Set();
  prodCats.forEach(c => allUsed.add(c.category));
  toyCats.forEach(c => allUsed.add(c.category));

  // 5. 找孤儿
  const orphans = [...allUsed].filter(name => !existSet.has(name));

  console.log('\n━━━ 扫到的孤儿 category ━━━');
  console.log('products 用过的:', prodCats.length, '种');
  console.log('toys 用过的:', toyCats.length, '种');
  console.log('分类表已有:', existSet.size, '种');
  console.log('孤儿（数据用但分类表没登记）:', orphans.length, '种');
  if (orphans.length === 0) {
    console.log('\n✓ 无孤儿，无需补登。');
  } else {
    orphans.forEach(o => console.log('  · ' + o));
    console.log('\n━━━ 补登中 ━━━');
    let added = 0, failed = 0;
    for (const name of orphans) {
      try {
        await i('INSERT INTO categories (name, color, parent_id) VALUES (?, ?, ?)', [name, '#6b7085', null]);
        added++;
        console.log('  ✓ 新建:', name);
      } catch (e) {
        failed++;
        console.log('  ✗ ' + name + ' 失败:', e.message);
      }
    }
    console.log('\n共补登', added, '条，失败', failed, '条');
  }

  console.log('\n━━━ AFTER ━━━');
  const catsAfter = await q('SELECT COUNT(*) as n FROM categories');
  console.log('分类总数:', catsAfter[0].n);
  console.log('\n✓ 完成。请重启服务器：pkill -9 -f "node.*server.js" && PORT=7685 nohup node server.js > /tmp/server.log 2>&1 &');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
