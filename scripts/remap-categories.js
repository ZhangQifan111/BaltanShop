/**
 * 一键批量重映射 toys.category 从英文简写 → 分类表里的中文
 *
 * 背景：
 *   toys.category 是玩具身上写的分类字符串；「商品分类」表（categories）是用户在设置里管理的中文分类。
 *   两套数据历来没有对齐，导入时直接写 gacha/kit/plush 等英文，但分类表里是中文（食玩/积木人/扭蛋等）。
 *   本脚本把英文重命名到中文，让仓库页"系列：xxx"分组跟设置里的分类对得上。
 *
 * 用法（在终端跑）：
 *   node scripts/remap-categories.js
 *
 * 跑完会打印 before/after 对比。改完后需重启服务器才能让内存里的 db 重新读盘。
 */

const { getDb, all: q, run: r, insert: i } = require('../db/database');

const MAPPING = [
  ['other',   '其他'],
  ['vinyl',   'vinyl'],     // 已经是顶级英文，保留
  ['figure',  'figure'],    // 同上
  ['gacha',   '扭蛋'],       // ← 关键修复
  ['kit',     '积木人'],     // ← 关键修复
  ['card',    '卡片'],
  ['plush',   '毛绒'],       // 分类表里没有，会自动新建顶级
  ['sofubi',  'sofubi'],
  ['xplus',   'xplus'],
  ['M78toys', 'M78toys'],
  ['M1号',    'M1号'],
  ['Enka',    'Enka'],
  ['公牛社',  '公牛社'],
  ['丸三450', '丸三450'],
];

(async () => {
  await getDb();

  console.log('━━━ BEFORE ━━━');
  const before = await q('SELECT category, COUNT(*) as n FROM toys GROUP BY category ORDER BY n DESC');
  before.forEach(row => console.log('  ' + row.category.padEnd(14) + row.n));

  // 1. 自动新建「毛绒」分类（如不存在）
  const plushExist = await q("SELECT id FROM categories WHERE name = '毛绒'");
  if (!plushExist.length) {
    const id = await i("INSERT INTO categories (name, color, parent_id) VALUES (?, ?, ?)", ['毛绒', '#ec4899', null]);
    console.log('\n✓ 新建顶级分类「毛绒」id=' + id);
  } else {
    console.log('\n「毛绒」已存在，id=' + plushExist[0].id);
  }

  // 2. 批量 UPDATE
  console.log('\n━━━ 重映射 ━━━');
  for (const [from, to] of MAPPING) {
    const cnt = await q('SELECT COUNT(*) as n FROM toys WHERE category = ?', [from]);
    if (!cnt[0].n) continue;
    await r('UPDATE toys SET category = ? WHERE category = ?', [to, from]);
    console.log('  ' + from.padEnd(10) + ' → ' + to.padEnd(10) + ' (' + cnt[0].n + ' 条)');
  }

  console.log('\n━━━ AFTER ━━━');
  const after = await q('SELECT category, COUNT(*) as n FROM toys GROUP BY category ORDER BY n DESC');
  after.forEach(row => console.log('  ' + row.category.padEnd(14) + row.n));

  console.log('\n✓ 完成。请重启服务器：pkill -9 -f "node.*server.js" && PORT=7685 nohup node server.js > /tmp/server.log 2>&1 &');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
