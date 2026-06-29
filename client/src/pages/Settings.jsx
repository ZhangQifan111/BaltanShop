import { useState, useEffect } from 'react';
import useStore from '../stores/useStore';
import { api } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';


export default function Settings() {
  const { suppliers, feeRules, addSupplier, addFeeRule, deleteFeeRule, setToast } = useStore();
  const [newSupplier, setNewSupplier] = useState({ name: '', source: '', contact: '' });
  const [newRule, setNewRule] = useState({ name: '', fee_type: 'xianyu', rate: '1.6', flat_fee: '0' });
  const [categories, setCategories] = useState([]);
  const [catTree, setCatTree] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [newCatParent, setNewCatParent] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [bgLeft, setBgLeft] = useState('');
  const [bgRight, setBgRight] = useState('');
  const [processing, setProcessing] = useState(false);
  const [monsterImages, setMonsterImages] = useState([]);

  const saveBg = async (key, value) => {
    let finalUrl = value;
    if (value && !value.includes('-toy')) {
      setProcessing(true);
      try {
        const r = await api.post('/process-toy-image', { url: value });
        finalUrl = r.toy_url;
      } catch { /* use original value if processing fails */ }
      setProcessing(false);
    }
    api.put('/settings', { [key]: finalUrl }).then(s => {
      setBgLeft(s.bg_left_url || '');
      setBgRight(s.bg_right_url || '');
    }).catch(() => {});
  };

  useEffect(() => {
    api.get('/settings/categories')
      .then(data => {
        setCategories(data.flat || data);
        setCatTree(data.tree || data);
      })
      .catch(() => {});
    api.get('/products')
      .then(prods => setProducts(prods))
      .catch(() => {});
    api.get('/settings')
      .then(s => { setBgLeft(s.bg_left_url || ''); setBgRight(s.bg_right_url || ''); })
      .catch(() => {});
    api.get('/process-toy-image')
      .then(d => setMonsterImages(d.images || []))
      .catch(() => {});
  }, []);

  const handleUpdateProduct = async (id, updates) => {
    try {
      await api.put(`/products/${id}`, updates);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      setEditingProduct(null);
      setToast('已更新');
    } catch (e) {
      setToast('更新失败: ' + e.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await api.del(`/products/${id}`);
      setProducts(prev => prev.filter(p => p.id !== id));
      setPendingDelete(null);
      setToast('已删除');
    } catch (e) {
      setToast('删除失败: ' + (e.message || '可能有商品关联'));
      setPendingDelete(null);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    try {
      const created = await api.post('/settings/categories', {
        name: newCat.trim(),
        parent_id: newCatParent || null,
      });
      setCategories(prev => [...prev, created]);
      setCatTree(prev => {
        if (!newCatParent) return [...prev, { ...created, children: [] }];
        return prev.map(node => addChild(node, Number(newCatParent), created));
      });
      setNewCat('');
      setNewCatParent('');
    } catch (err) {
      setToast(err.message || '添加失败');
    }
  };

  const addChild = (node, parentId, child) => {
    if (node.id === parentId) return { ...node, children: [...(node.children||[]), { ...child, children: [] }] };
    if (node.children) return { ...node, children: node.children.map(c => addChild(c, parentId, child)) };
    return node;
  };

  const [expanded, setExpanded] = useState(new Set());

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (nodes, depth, onDelete, onAddChild) => {
    if (!nodes || nodes.length === 0) return null;
    return nodes.map(node => {
      const hasChildren = node.children?.length > 0;
      const isOpen = expanded.has(node.id);
      return (
      <div key={node.id}>
        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs group cursor-pointer select-none"
          style={{ marginLeft: depth * 16 }}
          onClick={() => hasChildren && toggleExpand(node.id)}
        >
          <span className="text-[#6b7085] w-3 text-center shrink-0">
            {hasChildren ? (isOpen ? '▼' : '▶') : (depth > 0 ? '└' : '')}
          </span>
          <span>{node.name}</span>
          {hasChildren && <span className="text-[10px] text-[#6b7085]">({node.children.length})</span>}
          <button
            className="text-accent opacity-0 group-hover:opacity-100 text-[10px] px-1 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onAddChild(node); }}
            title="添加子分类"
          >+</button>
          <button
            className="text-red-400 opacity-0 group-hover:opacity-100 text-[10px] transition-opacity"
            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
            title="删除"
          >×</button>
        </div>
        {hasChildren && isOpen && renderTree(node.children, depth + 1, onDelete, onAddChild)}
      </div>
      );
    });
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api.del(`/settings/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
      setCatTree(prev => removeFromTree(prev, id));
      setPendingDelete(null);
    } catch (e) {
      setToast?.('删除失败: ' + (e.message || ''));
      setPendingDelete(null);
    }
  };

  const flattenTreeOptions = (nodes, depth = 0) => {
    if (!nodes || nodes.length === 0) return [];
    const result = [];
    for (const n of nodes) {
      result.push({ id: n.id, label: (depth > 0 ? '└ '.repeat(depth) : '') + n.name });
      result.push(...flattenTreeOptions(n.children || [], depth + 1));
    }
    return result;
  };

  const removeFromTree = (nodes, id) => {
    return nodes.filter(n => n.id !== id).map(n => ({
      ...n,
      children: n.children ? removeFromTree(n.children, id) : []
    }));
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    await addSupplier(newSupplier);
    setNewSupplier({ name: '', source: '', contact: '' });
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newRule.name) return;
    await addFeeRule({ ...newRule, rate: +newRule.rate, flat_fee: +newRule.flat_fee });
    setNewRule({ name: '', fee_type: 'xianyu', rate: '1.6', flat_fee: '0' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">设置</h2>
        <p className="text-xs text-[#6b7085]">分类管理、池商品管理、数据备份</p>
      </div>

      {/* 背景装饰 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">背景装饰</div>
        <p className="text-xs text-[#6b7085] mb-3">选择左右两侧的玩具角色（自动抠图）</p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[#6b7085]">左侧图片</label>
            <select
              className="input text-xs w-full"
              value={bgLeft || ''}
              onChange={e => saveBg('bg_left_url', e.target.value)}
            >
              <option value="">默认（巴尔坦星人）</option>
              {monsterImages.map(g => (
                <optgroup key={g.character} label={g.character}>
                  {g.images.map(img => (
                    <option key={img.url} value={img.url}>{img.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#6b7085]">右侧图片（自动镜像翻转）</label>
            <select
              className="input text-xs w-full"
              value={bgRight || ''}
              onChange={e => saveBg('bg_right_url', e.target.value)}
            >
              <option value="">默认（奥特曼）</option>
              {monsterImages.map(g => (
                <optgroup key={g.character} label={g.character}>
                  {g.images.map(img => (
                    <option key={img.url} value={img.url}>{img.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-[#6b7085]">选择后自动抠图处理，刷新页面即可看到效果。</p>
          {processing && <p className="text-[10px] text-accent mt-1">正在抠图处理中...</p>}
        </div>
      </div>

{/* 供应商管理 — 暂不启用 */}
      {false && <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">供应商</div>
        <form className="flex gap-2 mb-4" onSubmit={handleAddSupplier}>
          <input className="input text-xs flex-1" placeholder="供应商名称" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
          <input className="input text-xs w-28" placeholder="来源" value={newSupplier.source} onChange={e => setNewSupplier({ ...newSupplier, source: e.target.value })} />
          <button type="submit" className="btn-primary text-xs">添加</button>
        </form>
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <div className="text-sm">{s.name}</div>
                {s.source && <div className="text-[10px] text-[#6b7085]">{s.source}</div>}
              </div>
              {s.contact && <div className="text-xs text-[#6b7085]">{s.contact}</div>}
            </div>
          ))}
          {suppliers.length === 0 && <div className="text-xs text-[#6b7085] text-center py-4">暂无供应商</div>}
        </div>
      </div>}

{/* 费用规则 — 暂不启用 */}
      {false && <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">费用规则</div>
        <form className="flex gap-2 mb-4 flex-wrap" onSubmit={handleAddRule}>
          <input className="input text-xs flex-1" placeholder="规则名称" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} />
          <select className="input text-xs w-24" value={newRule.fee_type} onChange={e => setNewRule({ ...newRule, fee_type: e.target.value })}>
            <option value="xianyu">闲鱼</option>
            <option value="huabei">花呗</option>
            <option value="other">其他</option>
          </select>
          <input className="input text-xs w-20" type="text" inputmode="decimal" step="0.1" placeholder="费率%" value={newRule.rate} onChange={e => setNewRule({ ...newRule, rate: e.target.value })} />
          <button type="submit" className="btn-primary text-xs">添加</button>
        </form>
        <div className="space-y-2">
          {feeRules.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <div className="text-sm">{r.name}</div>
                <div className="text-[10px] text-[#6b7085]">{r.fee_type === 'xianyu' ? '闲鱼' : r.fee_type === 'huabei' ? '花呗' : '其他'} · {r.rate}% {r.flat_fee > 0 ? `+ ¥${r.flat_fee}` : ''}</div>
              </div>
              <button className="btn-ghost text-xs text-red-400" onClick={() => setPendingDelete({ type: 'feeRule', id: r.id, name: r.name })}>删除</button>
            </div>
          ))}
          {feeRules.length === 0 && <div className="text-xs text-[#6b7085] text-center py-4">暂无费用规则</div>}
        </div>
      </div>}

      {/* 分类管理 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">商品分类（支持层级）</div>
        <form className="flex gap-2 mb-3 flex-wrap" onSubmit={handleAddCategory}>
          <input className="input text-xs flex-1 min-w-[120px]" placeholder="新分类名称" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <select className="input text-xs w-32" value={newCatParent} onChange={e => setNewCatParent(e.target.value)}>
            <option value="">顶级分类</option>
            {flattenTreeOptions(catTree).map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary text-xs">添加</button>
        </form>
        <div className="space-y-1">
          {renderTree(
            catTree, 0,
            cat => setPendingDelete({ type: 'category', id: cat.id, name: cat.name }),
            cat => { setNewCatParent(String(cat.id)); document.querySelector('input[placeholder=\"新分类名称\"]')?.focus(); }
          )}
        </div>
        {categories.length === 0 && <div className="text-xs text-[#6b7085] mt-2">暂无分类</div>}
        <p className="text-[10px] text-[#6b7085] mt-3">点击分类可删除</p>
      </div>

      {/* 池商品管理 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">池商品管理</div>
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {products.map(p => {
              return (
                <div key={p.id} className="rounded-lg p-3 border border-white/[0.08] bg-white/[0.02] cursor-pointer"
                  onClick={() => setEditingProduct(p.id)}>
                  {editingProduct === p.id ? (
                    <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                      <input className="input text-xs w-full" placeholder="名称" defaultValue={p.name_zh || p.name}
                        onBlur={e => handleUpdateProduct(p.id, { name: e.target.value, name_zh: e.target.value, category: p.category })} />
                      <select className="input text-xs w-full" defaultValue={p.category}
                        onChange={e => handleUpdateProduct(p.id, { name: p.name, name_zh: p.name_zh, category: e.target.value })}>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.parent_id ? '└ ' : ''}{c.name}</option>)}
                      </select>
                      <button className="text-[10px] text-[#6b7085]"
                        onClick={() => setEditingProduct(null)}>完成编辑</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate text-white">{p.name_zh || p.name || '未命名'}</div>
                          <div className="text-[10px] text-[#8b90a5]">{p.category || ''} · {p.batch_count || 0} 批次</div>
                        </div>
                        <span className="text-base font-bold text-accent shrink-0">{p.total_remaining}</span>
                      </div>
                      <div className="text-[10px] text-[#9ba0b5]">
                        {p.total_qty} 件 · 在库 {p.total_remaining} 件
                      </div>
                      <button className="btn-ghost text-[10px] text-red-400 mt-2"
                        onClick={e => { e.stopPropagation(); setPendingDelete({ type: 'product', id: p.id, name: p.name_zh || p.name }); }}>
                        删除
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[#6b7085] text-center py-4">暂无池商品</div>
        )}
        <p className="text-[10px] text-[#6b7085] mt-3">点击卡片可编辑名称和分类 · 仅无关联记录的商品可删除</p>
      </div>

      {/* 备份 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">数据备份</div>
        <p className="text-xs text-[#6b7085] mb-3">启动时会自动备份，最近 10 份保存在服务器上</p>
        <button
          className="btn-primary text-xs"
          onClick={async () => {
            try {
              const res = await fetch('/api/backup', { method: 'POST' });
              const data = await res.json();
              setToast('备份成功: ' + data.filename);
            } catch (e) {
              setToast('备份失败');
            }
          }}
        >
          立即备份
        </button>
      </div>

      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.type === 'category' ? '删除分类' : pendingDelete.type === 'product' ? '删除池商品' : '删除费用规则'}
          message={`确认删除「${pendingDelete.name}」吗？`}
          onConfirm={async () => {
            try {
              if (pendingDelete.type === 'category') {
                await handleDeleteCategory(pendingDelete.id);
              } else if (pendingDelete.type === 'product') {
                await handleDeleteProduct(pendingDelete.id);
              } else {
                await deleteFeeRule(pendingDelete.id);
                setPendingDelete(null);
              }
            } catch (e) {
              setPendingDelete(null);
            }
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

    </div>
  );
}
