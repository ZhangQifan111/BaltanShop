const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      db.update(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
        [key, String(value)]
      );
    }
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings/categories
router.get('/categories', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM categories ORDER BY id');
    // 返回树形结构
    const tree = [];
    const map = {};
    for (const r of rows) {
      map[r.id] = { ...r, children: [] };
    }
    for (const r of rows) {
      if (r.parent_id && map[r.parent_id]) {
        map[r.parent_id].children.push(map[r.id]);
      } else {
        tree.push(map[r.id]);
      }
    }
    // 平铺列表：深度优先，子项紧跟在父项后面
    function flatten(nodes) {
      const out = [];
      for (const n of nodes) {
        out.push({ id: n.id, name: n.name, color: n.color, parent_id: n.parent_id, created_at: n.created_at });
        if (n.children.length) out.push(...flatten(n.children));
      }
      return out;
    }
    res.json({ flat: flatten(tree), tree });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/settings/categories
router.post('/categories', async (req, res) => {
  try {
    const { name, color, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const pid = parent_id ? Number(parent_id) : null;
    const id = await db.insert(
      'INSERT INTO categories (name, color, parent_id) VALUES (?, ?, ?)',
      [name.trim(), color || '#6b7085', pid]
    );
    const row = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '分类已存在' });
    }
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/settings/categories/:id — 删除前检测 toys/products 引用
router.delete('/categories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: '分类不存在' });

    // 检测被引用数（防止删除后产生孤儿数据）
    const toyRef = await db.get('SELECT COUNT(*) as n FROM toys WHERE category = ?', [existing.name]);
    const prodRef = await db.get('SELECT COUNT(*) as n FROM products WHERE category = ?', [existing.name]);
    if (toyRef.n > 0 || prodRef.n > 0) {
      return res.status(400).json({
        error: `该分类被引用：${toyRef.n} 个玩具、${prodRef.n} 个池。请先把它们的 category 改成别的，或用改名功能。`,
        references: { toys: toyRef.n, products: prodRef.n }
      });
    }

    db.update('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings/categories/:id — 改名 / 移动到新父分类 / 改 color
router.put('/categories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: '分类不存在' });
    const { name, parent_id, color } = req.body;

    // parent_id：null = 顶级；非 null = 指定父；未传 = 不动
    let newParent = existing.parent_id;
    if (parent_id !== undefined) {
      const pid = parent_id === null || parent_id === '' ? null : Number(parent_id);
      if (pid === id) return res.status(400).json({ error: '不能把自己设为父分类' });
      // 防成环：祖辈不能包括自己（简化版：只禁止 pid 是 id 的子孙）
      if (pid !== null) {
        const isDescendant = await db.get(
          `WITH RECURSIVE sub AS (
             SELECT id, parent_id FROM categories WHERE id = ?
             UNION ALL
             SELECT c.id, c.parent_id FROM categories c JOIN sub s ON c.parent_id = s.id
           )
           SELECT 1 AS ok FROM sub WHERE id = ?`,
          [pid, id]
        );
        if (isDescendant) {
          return res.status(400).json({ error: '不能移动到自己的子分类下（会造成循环）' });
        }
      }
      newParent = pid;
    }

    const oldName = existing.name;
    const newName = (name !== undefined ? String(name).trim() : existing.name) || existing.name;
    const newColor = color || existing.color;

    // 改名同步：先算旧名字下被引用数，再 UPDATE（UPDATE 后旧名计数为 0）
    let updatedToys = 0;
    let updatedProducts = 0;
    if (oldName !== newName) {
      const toyCnt = await db.get('SELECT COUNT(*) as n FROM toys WHERE category = ?', [oldName]);
      const prodCnt = await db.get('SELECT COUNT(*) as n FROM products WHERE category = ?', [oldName]);
      updatedToys = toyCnt.n;
      updatedProducts = prodCnt.n;
    }

    db.update('UPDATE categories SET name = ?, parent_id = ?, color = ? WHERE id = ?',
      [newName, newParent, newColor, id]);

    if (updatedToys > 0 || updatedProducts > 0) {
      db.update('UPDATE toys SET category = ? WHERE category = ?', [newName, oldName]);
      db.update('UPDATE products SET category = ? WHERE category = ?', [newName, oldName]);
      console.log(`[categories PUT] 同步改名: "${oldName}" → "${newName}"（${updatedToys} toys, ${updatedProducts} products）`);
    }

    const row = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ ...row, _sync: { toys: updatedToys, products: updatedProducts } });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '同级下已有同名分类' });
    }
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
