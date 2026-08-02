import { useState, useEffect, useRef } from 'react';
import useStore from '../stores/useStore';
import { api } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';


export default function Settings() {
  const { suppliers, feeRules, addSupplier, addFeeRule, deleteFeeRule, setToast } = useStore();
  // 编辑池商品：所有改动暂存本地，只有用户点「保存」才发请求
  // 放在 Settings() 顶层（不能在 .map 回调里用 hook）
  const pendingUpdatesRef = useRef({});
  const stageProductUpdate = (id, updates) => {
    pendingUpdatesRef.current[id] = { ...pendingUpdatesRef.current[id], ...updates };
  };
  const commitProductUpdate = (id) => {
    const pending = pendingUpdatesRef.current[id];
    if (pending && Object.keys(pending).length > 0) {
      handleUpdateProduct(id, pending);
    }
    delete pendingUpdatesRef.current[id];
  };
  const discardProductUpdate = (id) => {
    delete pendingUpdatesRef.current[id];
  };
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
  const [movingCat, setMovingCat] = useState(null); // { id, name, currentParentId } | null

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

  const renderTree = (nodes, depth, onDelete, onAddChild, onMove) => {
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
            className="text-yellow-400 opacity-0 group-hover:opacity-100 text-[10px] px-1 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onMove(node); }}
            title="移动 / 改名"
          >↗</button>
          <button
            className="text-red-400 opacity-0 group-hover:opacity-100 text-[10px] transition-opacity"
            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
            title="删除"
          >×</button>
        </div>
        {hasChildren && isOpen && renderTree(node.children, depth + 1, onDelete, onAddChild, onMove)}
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
      setToast?.('已删除');
    } catch (e) {
      // 引用错误时弹更清楚的提示
      setPendingDelete(null);
      const msg = e.message || '';
      if (msg.includes('被引用')) {
        setToast?.('⚠️ 该分类正在被使用：' + msg);
      } else {
        setToast?.('删除失败: ' + msg);
      }
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

  // 把指定分类从旧父下挪到新父下（newParentId === null 则提到顶级）
  const moveInTree = (nodes, id, newParentId) => {
    let extracted = null;
    const extract = (arr) => {
      const out = [];
      for (const n of arr) {
        if (n.id === id) { extracted = { ...n, parent_id: newParentId }; continue; }
        out.push({ ...n, children: extract(n.children || []) });
      }
      return out;
    };
    const stripped = extract(nodes);
    if (!extracted) return nodes;
    if (newParentId === null) {
      return [...stripped, { ...extracted, children: [] }];
    }
    const insert = (arr) => arr.map(n => {
      if (n.id === newParentId) {
        return { ...n, children: [...(n.children || []), { ...extracted, children: [] }] };
      }
      return { ...n, children: insert(n.children || []) };
    });
    return insert(stripped);
  };

  // 收集某节点的所有子孙 id（防止把分类移到自己的子节点下形成环）
  const collectDescendantIds = (nodes, targetId) => {
    const out = new Set();
    const dfs = (arr) => {
      for (const n of arr) {
        if (n.id === targetId) {
          const collectSub = (subArr) => {
            for (const s of subArr) {
              out.add(s.id);
              collectSub(s.children || []);
            }
          };
          collectSub(n.children || []);
          return true;
        }
        if (dfs(n.children || [])) return true;
      }
      return false;
    };
    dfs(nodes);
    return out;
  };

  const handleMoveCategory = async (id, newParentId, newName) => {
    try {
      const updated = await api.put(`/settings/categories/${id}`, {
        parent_id: newParentId,
        name: newName,
      });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
      setCatTree(prev => moveInTree(prev, id, newParentId));
      setMovingCat(null);
      // 改名同步提示
      const sync = updated._sync;
      if (sync && (sync.toys > 0 || sync.products > 0)) {
        setToast(`已改名并同步 ${sync.toys} 个玩具 / ${sync.products} 个池`);
      } else {
        setToast('已移动');
      }
      // 强制刷新 products/toys 让前端 store 同步
      if (sync && (sync.toys > 0 || sync.products > 0)) {
        const { loadAll } = useStore.getState();
        loadAll();
      }
    } catch (e) {
      setToast('移动失败: ' + (e.message || ''));
    }
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

  // 收集所有可用作「父分类」的候选（排除自身 + 自身的后代，否则会成环）
  const movingDescendants = movingCat ? collectDescendantIds(catTree, movingCat.id) : new Set();
  const parentCandidates = categories.filter(c => {
    if (!movingCat) return false;
    if (c.id === movingCat.id) return false;
    if (movingDescendants.has(c.id)) return false;
    return true;
  });

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
            cat => { setNewCatParent(String(cat.id)); document.querySelector('input[placeholder=\"新分类名称\"]')?.focus(); },
            cat => setMovingCat({ id: cat.id, name: cat.name, parentId: cat.parent_id || null })
          )}
        </div>
        {categories.length === 0 && <div className="text-xs text-[#6b7085] mt-2">暂无分类</div>}
        <p className="text-[10px] text-[#6b7085] mt-3">点击分类可删除 · 悬停出现操作按钮</p>
      </div>

      {/* 池商品管理（与仓库页池卡片样式保持一致） */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest">池商品管理</div>
          <div className="text-[10px] text-[#6b7085]">{products.length} 款 · 点击卡片可编辑</div>
        </div>
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map(p => {
              const avgCost = (p.total_qty || 0) > 0 ? (p.total_cost || 0) / p.total_qty : 0;
              const unrecovered = p.unrecovered_cost ?? Math.max(0, (p.total_cost || 0) - (p.total_revenue || 0));
              const isBreakeven = (p.total_cost || 0) > 0 && unrecovered <= 0;
              const cardBorder = isBreakeven
                ? 'border border-green-500/30'
                : 'border border-orange-500/30';
              const cardBg = isBreakeven
                ? 'bg-gradient-to-b from-green-500/5 to-transparent'
                : 'bg-gradient-to-b from-orange-500/5 to-transparent';
              return (
                <div key={p.id} className={`rounded-xl p-3 ${cardBorder} ${cardBg} cursor-pointer transition-all hover:border-orange-500/50`}
                  onClick={() => setEditingProduct(p.id)}>
                  {editingProduct === p.id ? (
                    <div className="space-y-2" onClick={e => e.stopPropagation()}>
                      <div className="text-[10px] text-[#6b7085]">编辑名称</div>
                      <input className="input text-xs w-full" autoFocus placeholder="名称" defaultValue={p.name_zh || p.name}
                        lang="zh" spellCheck={false} autoComplete="off"
                        onChange={e => stageProductUpdate(p.id, { name: e.target.value, name_zh: e.target.value })} />
                      <div className="text-[10px] text-[#6b7085]">所属分类</div>
                      <select className="input text-xs w-full" defaultValue={p.category_id || ''}
                        onChange={e => stageProductUpdate(p.id, { name: p.name, name_zh: p.name_zh, category_id: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">— 不分类 —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.parent_id ? '└ ' : ''}{c.name}</option>)}
                      </select>
                      <div className="flex gap-2 pt-1">
                        <button className="btn-ghost flex-1 text-xs py-1.5"
                          onClick={() => { discardProductUpdate(p.id); setEditingProduct(null); }}>取消</button>
                        <button className="btn-primary flex-1 text-xs py-1.5"
                          onClick={() => { commitProductUpdate(p.id); setEditingProduct(null); }}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 mb-2">
                        {p.image && <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-white/5" loading="lazy" onError={e => e.target.style.display='none'} />}
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-bold truncate text-white">{p.name_zh || p.name || '未命名'}</div>
                          <div className="text-[11px] text-[#8b90a5]">{p.category || '未分类'} · {p.batch_count || 0} 批次</div>
                        </div>
                        <span className="text-lg font-bold text-accent shrink-0 ml-2">{p.total_remaining || 0}</span>
                      </div>

                      <div className="flex justify-between text-[11px] text-[#9ba0b5] mb-0.5">
                        <span className="font-semibold text-white/80">总成本 ¥{(p.total_cost || 0).toFixed(0)}</span>
                        <span>{p.total_qty || 0} 件 · 在库 <span className="text-accent font-semibold">{p.total_remaining || 0}</span> 件</span>
                      </div>

                      <div className="space-y-1 mt-2 p-2.5 rounded-lg bg-gradient-to-br from-orange-500/10 to-green-500/5 border border-orange-500/15">
                        <div className="flex justify-between text-[12px]">
                          <span className="text-white font-medium">📦 成本均价</span>
                          <span className="text-white font-bold">¥{avgCost.toFixed(0)}<span className="text-[10px] font-normal text-[#6b7085]">/件</span></span>
                        </div>
                        {(p.total_remaining || 0) > 0 && (() => {
                          const breakeven = p.total_remaining > 0 ? unrecovered / p.total_remaining : 0;
                          const profit10 = breakeven * 1.1;
                          const profit20 = breakeven * 1.2;
                          if (isBreakeven) {
                            return (
                              <div className="flex justify-between text-[12px]">
                                <span className="text-green-300 font-medium">🎯 回本价</span>
                                <span className="text-green-300 font-bold">已回本 ✓</span>
                              </div>
                            );
                          }
                          return (
                            <>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-orange-300 font-medium">🎯 回本价</span>
                                <span className="text-orange-300 font-bold">¥{breakeven.toFixed(0)}<span className="text-[10px] font-normal">/件</span></span>
                              </div>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-green-300 font-medium">💰 +10%利润</span>
                                <span className="text-green-300 font-bold">¥{profit10.toFixed(0)}<span className="text-[10px] font-normal">/件</span></span>
                              </div>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-emerald-300 font-medium">💰 +20%利润</span>
                                <span className="text-emerald-300 font-bold">¥{profit20.toFixed(0)}<span className="text-[10px] font-normal">/件</span></span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-[#6b7085]">点击卡片编辑</span>
                        <button className="btn-danger text-[10px] py-1 px-2 ml-auto"
                          onClick={e => { e.stopPropagation(); setPendingDelete({ type: 'product', id: p.id, name: p.name_zh || p.name }); }}>
                          删除
                        </button>
                      </div>
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

      {/* 移动 / 改分类名 */}
      {movingCat && (
        <MoveCategoryModal
          cat={movingCat}
          parentCandidates={parentCandidates}
          onConfirm={(newParentId, newName) => handleMoveCategory(movingCat.id, newParentId, newName)}
          onCancel={() => setMovingCat(null)}
        />
      )}

    </div>
  );
}

// ────────────────────────────────────────────
// 移动 / 改分类名 弹窗
// ────────────────────────────────────────────
function MoveCategoryModal({ cat, parentCandidates, onConfirm, onCancel }) {
  const [newParentId, setNewParentId] = useState(cat.parentId == null ? '__top__' : String(cat.parentId));
  const [newName, setNewName] = useState(cat.name);
  // 按层级顺序排列候选名
  const candidateById = new Map(parentCandidates.map(c => [c.id, c]));
  const orderedNames = (() => {
    const out = [];
    const roots = parentCandidates.filter(c => !c.parent_id);
    const visit = (n, depth) => {
      out.push({ id: n.id, label: (depth > 0 ? '└ '.repeat(depth) : '') + n.name });
      // 简单按名字顺序排儿子，不严格按树形
      const kids = parentCandidates.filter(c => c.parent_id === n.id).sort((a, b) => a.name.localeCompare(b.name));
      kids.forEach(k => visit(k, depth + 1));
    };
    roots.sort((a, b) => a.name.localeCompare(b.name)).forEach(r => visit(r, 0));
    return out;
  })();

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-bold mb-3">↗ 移动 / 改名「{cat.name}」</div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">新名称（不改保持原样）</label>
            <input
              className="input text-xs w-full"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              lang="zh" spellCheck={false} autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">移动到（顶级 = 不属于任何分类）</label>
            <select
              className="input text-xs w-full"
              value={newParentId}
              onChange={e => setNewParentId(e.target.value)}
            >
              <option value="__top__">— 顶级（无父分类）</option>
              {orderedNames.map(n => (
                <option key={n.id} value={String(n.id)}>{n.label}</option>
              ))}
            </select>
            {parentCandidates.length === 0 && (
              <p className="text-[10px] text-[#6b7085] mt-1">无其他可选父分类（只能移至顶级）</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1 text-xs" onClick={onCancel}>取消</button>
            <button
              className="btn-primary flex-1 text-xs"
              onClick={() => {
                const parentId = newParentId === '__top__' ? null : Number(newParentId);
                const trimmed = newName.trim();
                if (!trimmed) { alert('分类名不能为空'); return; }
                onConfirm(parentId, trimmed);
              }}
            >保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
