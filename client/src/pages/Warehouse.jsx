import { useState, useEffect, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ConfirmModal from '../components/ConfirmModal';
import useStore from '../stores/useStore';
import { api } from '../lib/api';
import { sourceLabel, sourceGroup, SOURCES } from '../lib/sources';

const FILTERS = [
  { key: 'stock', label: '在库' },
  { key: 'sold', label: '已发货' },
  { key: 'done', label: '已完成' },
];

const ToyCard = memo(function ToyCard({ toy, onSell, onEdit, onDelete, onReturn, onDone, onUnsell, onPoolify }) {
  const [doneLoading, setDoneLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const statusBadge = {
    stock: { label: '在库', bg: 'rgba(74,222,128,0.15)', color: '#34d399' },
    sold: { label: '已发货', bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
    done: { label: '已完成', bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
    returned: { label: '已退货', bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
  }[toy.status] || { label: toy.status, bg: 'rgba(255,255,255,0.05)', color: '#6b7085' };

  return (
    <div className="card cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start gap-3 mb-3">
        {toy.image && <img src={toy.image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-white/5 cursor-zoom-in hover:ring-2 hover:ring-accent/50 transition-all" loading="lazy" onError={e => e.target.style.display='none'} onClick={e => { e.stopPropagation(); setPreviewImage(toy.image); }} />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate mb-1">{toy.name_zh || toy.name}</div>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full" style={{ background: statusBadge.bg, color: statusBadge.color }}>
            {statusBadge.label}
          </span>
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-[10px] text-[#6b7085]">成本</div>
          <div className="text-sm font-bold text-accent">¥{toy.total_cost?.toFixed(0) || 0}</div>
          {toy.sell_price > 0 && (
            <>
              <div className="text-[10px] text-[#6b7085] mt-1">售价</div>
              <div className="text-sm font-bold text-green-400">¥{toy.sell_price}</div>
            </>
          )}
          {toy.profit != null && toy.profit !== 0 && (
            <>
              <div className="text-[10px] text-[#6b7085]">利润</div>
              <div className="text-sm font-bold" style={{ color: toy.profit >= 0 ? '#34d399' : '#f87171' }}>
                {toy.profit >= 0 ? '+' : ''}¥{toy.profit.toFixed(0)}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap text-[10px] text-[#6b7085] mb-3">
        <span>{sourceLabel(toy.source)}</span>
        <span>·</span>
        <span>{toy.category}</span>
        <span>·</span>
        <span>{toy.purchase_date || toy.created_at?.slice(0, 10)}</span>
      </div>

      {expanded && (
        <div className="border-t border-white/5 pt-3 mt-3 space-y-1 text-xs">
          {sourceGroup(toy.source) === 'direct' && (
            <>
              {toy.japan_price_cny > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">本体价</span><span>¥{toy.japan_price_cny}</span></div>}
              {toy.handling_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">手续费</span><span>¥{toy.handling_fee}</span></div>}
              {toy.japan_domestic_shipping > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">日本运费</span><span>¥{toy.japan_domestic_shipping}</span></div>}
              {toy.intl_shipping > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">国际运费</span><span>¥{toy.intl_shipping}</span></div>}
              {toy.tax > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">税费</span><span>¥{toy.tax}</span></div>}
            </>
          )}
          {sourceGroup(toy.source) === 'proxy' && (
            <>
              {toy.proxy_price > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">代购价</span><span>¥{toy.proxy_price}</span></div>}
              {toy.proxy_intl_shipping > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">国际运费</span><span>¥{toy.proxy_intl_shipping}</span></div>}
              {toy.proxy_domestic_shipping > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">国内运费</span><span>¥{toy.proxy_domestic_shipping}</span></div>}
            </>
          )}
          {toy.logistics_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">国内运费</span><span>¥{toy.logistics_fee}</span></div>}
          {toy.box_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">箱费</span><span>¥{toy.box_fee}</span></div>}
          {toy.packing_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">包装费</span><span>¥{toy.packing_fee}</span></div>}
          {toy.stage1_amount > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">①买价</span><span>¥{toy.stage1_amount}</span></div>}
          {toy.stage2_amount > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">②转运</span><span>¥{toy.stage2_amount}</span></div>}
          {toy.stage3_intl_ship > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">③国际运费</span><span>¥{toy.stage3_intl_ship}</span></div>}
          {toy.stage3_tax > 0 && <div className="flex justify-between pl-2"><span className="text-[#6b7085]">③税费</span><span>¥{toy.stage3_tax}</span></div>}
          {toy.logistics_type && (
            <div className="flex justify-between">
              <span className="text-[#6b7085]">路线</span>
              <span className={toy.stage3_tax_mode === 'tax_free' ? 'text-green-400' : ''}>
                {toy.logistics_type}{toy.stage3_tax_mode === 'tax_free' ? ' · 包税' : ''}
              </span>
            </div>
          )}
          {toy.profit != null && <div className="flex justify-between font-bold" style={{ color: toy.profit >= 0 ? '#34d399' : '#f87171' }}><span className="text-[#6b7085]">利润</span><span>{toy.profit >= 0 ? '+' : ''}¥{toy.profit.toFixed(0)}</span></div>}
          {toy.notes && <div className="flex justify-between text-[#6b7085]"><span>备注</span><span className="text-right max-w-[60%] truncate">{toy.notes}</span></div>}
        </div>
      )}

      {/* 主操作 */}
      <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
        {toy.status === 'stock' && (
          <button className="btn-primary w-full text-sm py-2.5" onClick={e => { e.stopPropagation(); onSell(toy); }}>出售</button>
        )}
        {(toy.status === 'sold' || toy.status === 'done') && (
          <button className="btn-primary w-full text-sm py-2.5" onClick={e => { e.stopPropagation(); onEdit(toy); }}>编辑售价</button>
        )}
        {toy.status !== 'stock' && toy.status !== 'sold' && toy.status !== 'done' && (
          <button className="btn-primary w-full text-sm py-2.5" onClick={e => { e.stopPropagation(); onEdit(toy); }}>编辑</button>
        )}

        {/* 次操作横排 */}
        <div className="flex items-center gap-2">
          {toy.status === 'stock' && (
            <button className="btn-outline flex-1" onClick={e => { e.stopPropagation(); onEdit(toy); }}>编辑</button>
          )}
          {toy.status === 'stock' && (
            <button className="btn-ghost flex-1 text-xs text-orange-400" onClick={e => { e.stopPropagation(); onPoolify(toy); }}>入池</button>
          )}
          <button className="btn-danger" onClick={e => { e.stopPropagation(); onDelete(toy.id); }}>删除</button>
          {toy.status === 'sold' && (
            <>
              <button className="btn-ghost flex-1 text-xs text-yellow-400" onClick={e => { e.stopPropagation(); onUnsell(toy.id); }}>退回仓库</button>
              <button className="btn-warn flex-1" onClick={e => { e.stopPropagation(); onReturn(toy); }}>退换</button>
              <button className="btn-success flex-1 disabled:opacity-50" disabled={doneLoading}
                onClick={async e => { e.stopPropagation(); setDoneLoading(true); try { await onDone(toy.id); } finally { setDoneLoading(false); } }}>
                {doneLoading ? '处理中…' : '确认完成'}
              </button>
            </>
          )}
          {toy.status === 'done' && (
            <button className="btn-ghost flex-1 text-xs text-yellow-400" onClick={e => { e.stopPropagation(); onUnsell(toy.id); }}>退回仓库</button>
          )}
        </div>
      </div>

      {/* 图片大图预览 — Portal 到 body 确保全屏 */}
      {previewImage && createPortal(
        <div className="fixed inset-0 bg-black/95 z-[9999]"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setPreviewImage(null); }}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl z-10"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setPreviewImage(null); }}>✕</button>
          <img src={previewImage} alt="" className="absolute inset-0 w-full h-full object-contain"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </div>
  );
});

/* ─── 池详情弹窗 ─── */
function PoolDetailModal({ group, onClose, onSell, onUnpoolify, onBatchUnpoolify }) {
  const prod = group.product;
  const avgCost = group.totalQty > 0 ? group.totalCost / group.totalQty : 0;
  const [selectedIds, setSelectedIds] = useState(new Set());
  const allIds = group.batches.map(b => b.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = allIds.some(id => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBatchUnpoolify = () => {
    const batches = group.batches.filter(b => selectedIds.has(b.id));
    if (batches.length === 0) return;
    onBatchUnpoolify(batches);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1d27] rounded-xl border border-orange-500/20 w-full max-w-md flex flex-col" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            {prod?.image && <img src={prod.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-white/5" onError={e => e.target.style.display = 'none'} />}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold truncate">{prod?.name_zh || prod?.name || '未命名'}</h3>
              <div className="text-[10px] text-[#6b7085]">{prod?.category || ''} · {group.batches.length} 批次</div>
            </div>
            <button className="text-[#6b7085] hover:text-white text-lg px-1" onClick={onClose}>✕</button>
          </div>
          <div className="flex justify-between mt-3 text-xs">
            <span>均价 <span className="text-white font-bold">¥{avgCost.toFixed(0)}</span></span>
            <span>总成本 <span className="text-white font-bold">¥{group.totalCost.toFixed(0)}</span></span>
            <span>在库 <span className="text-accent font-bold">{group.totalRemaining}</span>/{group.totalQty} 件</span>
          </div>
          {/* 批量操作栏 */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none" onClick={e => e.stopPropagation()}>
              <input type="checkbox" className="w-3.5 h-3.5 accent-yellow-500 cursor-pointer"
                checked={allSelected}
                onChange={toggleAll}
              />
              <span className="text-[#9ca3af]">{allSelected ? '取消全选' : '全选'}</span>
            </label>
            {someSelected && (
              <button className="text-[11px] px-3 py-1 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 font-medium"
                onClick={handleBatchUnpoolify}>
                批量退池 ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Batch list */}
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {group.batches.map(b => (
            <div key={b.id} className={`bg-white/[0.03] rounded-lg p-3 text-xs flex gap-3 ${selectedIds.has(b.id) ? 'ring-1 ring-yellow-500/50 bg-yellow-500/[0.05]' : ''}`}>
              {/* 选择框 */}
              <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
                <input type="checkbox" className="w-3.5 h-3.5 accent-yellow-500 cursor-pointer"
                  checked={selectedIds.has(b.id)}
                  onChange={() => toggleOne(b.id)}
                />
              </div>
              {b.image && (
                <img src={b.image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-white/5" onError={e => e.target.style.display = 'none'} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <span className="truncate flex-1 mr-2 font-medium">{b.name_zh || b.name}</span>
                  <span className="font-bold text-accent shrink-0">剩 {b.remaining}/{b.quantity}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#6b7085] mb-2">
                  <span>成本 ¥{(b.total_cost || 0).toFixed(0)} · 单价 ¥{(b.unit_cost || 0).toFixed(0)}</span>
                  <span>{b.purchase_date || b.created_at?.slice(0, 10)}</span>
                </div>
                <div className="flex justify-end gap-1.5">
                  <button className="text-[10px] px-2 py-0.5 rounded border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
                    onClick={() => onSell(group, b.id)}>
                    出售
                  </button>
                  <button className="text-[10px] px-2 py-0.5 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"
                    onClick={() => onUnpoolify(b)}>
                    退池
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── 入池弹窗 ─── */
function PoolifyModal({ toy, products, onConfirm, onCancel }) {
  const [poolLines, setPoolLines] = useState([{ product_id: '', quantity: '', search: '', showDropdown: false }]);
  const totalCost = toy.total_cost || 0;
  const toyQty = toy.quantity || 1;

  // 各行参考成本
  const linesWithRef = poolLines.map(l => {
    const prod = l.product_id ? products.find(p => p.id === Number(l.product_id)) : null;
    const qty = Number(l.quantity) || 0;
    const refUnit = prod?.avg_unit_cost || 0;
    const refCost = refUnit * qty;
    return { ...l, prod, qty, refUnit, refCost };
  });
  const totalQty = linesWithRef.reduce((s, l) => s + l.qty, 0);
  const totalRefCost = linesWithRef.reduce((s, l) => s + l.refCost, 0);
  const ratio = totalRefCost > 0 ? totalCost / totalRefCost : 0;

  const updateLine = (idx, field, value) => setPoolLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  const addLine = () => setPoolLines(prev => [...prev, { product_id: '', quantity: '', search: '', showDropdown: false }]);
  const removeLine = (idx) => { if (poolLines.length <= 1) return; setPoolLines(prev => prev.filter((_, i) => i !== idx)); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validLines = poolLines.filter(l => l.product_id && (Number(l.quantity) || 0) > 0);
    if (validLines.length === 0) return;
    onConfirm({
      lines: validLines.map(l => ({
        product_id: l.product_id === '__new__' ? null : Number(l.product_id),
        quantity: Number(l.quantity),
      })),
      totalCost,
      totalRefCost,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-orange-500/20 p-5 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold">转入池模式 — 拆分到多个池</h3>
        <div className="text-xs text-[#6b7085]">「{toy.name_zh || toy.name}」共 {toyQty} 件 · 总成本 ¥{totalCost.toFixed(0)}</div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {poolLines.map((line, idx) => {
            const ref = linesWithRef[idx];
            const allocated = totalRefCost > 0 && ref.refCost > 0
              ? Math.round(ref.refCost * ratio * 100) / 100
              : 0;
            const selectedProd = line.product_id && line.product_id !== '__new__'
              ? products.find(p => p.id === Number(line.product_id)) : null;
            const isNew = line.product_id === '__new__';
            const filtered = line.search?.trim()
              ? products.filter(p => {
                  const s = line.search.toLowerCase();
                  return (p.name_zh || '').toLowerCase().includes(s)
                    || (p.name || '').toLowerCase().includes(s)
                    || (p.category || '').toLowerCase().includes(s);
                })
              : products;

            return (
              <div key={idx} className="bg-white/[0.03] rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#6b7085] shrink-0">#{idx + 1}</span>
                  <div className="relative flex-1">
                    {selectedProd ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1 input text-xs bg-white/5 flex items-center gap-2 truncate">
                          <span className="truncate">{selectedProd.name_zh || selectedProd.name}</span>
                          <span className="text-[10px] text-[#6b7085] shrink-0">[{selectedProd.category}]</span>
                        </div>
                        <button type="button" className="text-[10px] text-[#6b7085] hover:text-white px-1 shrink-0"
                          onClick={() => updateLine(idx, 'product_id', '')}>✕</button>
                      </div>
                    ) : isNew ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1 input text-xs bg-white/5 text-orange-400">新建商品（名称同玩具）</div>
                        <button type="button" className="text-[10px] text-[#6b7085] hover:text-white px-1 shrink-0"
                          onClick={() => updateLine(idx, 'product_id', '')}>✕</button>
                      </div>
                    ) : (
                      <>
                        <input className="input text-xs w-full" placeholder="搜索商品…"
                          value={line.search || ''}
                          onFocus={() => updateLine(idx, 'showDropdown', true)}
                          onBlur={() => setTimeout(() => updateLine(idx, 'showDropdown', false), 200)}
                          onChange={e => { updateLine(idx, 'search', e.target.value); updateLine(idx, 'showDropdown', true); }} />
                        {line.showDropdown && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1d27] border border-gray-600 rounded-lg max-h-40 overflow-y-auto z-50 shadow-xl">
                            {filtered.map(p => (
                              <button type="button" key={p.id}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 border-b border-gray-700/50 last:border-b-0"
                                onPointerDown={() => { updateLine(idx, 'product_id', String(p.id)); updateLine(idx, 'search', ''); updateLine(idx, 'showDropdown', false); }}>
                                <span className="truncate flex-1">{p.name_zh || p.name}</span>
                                <span className="text-[10px] text-[#6b7085] shrink-0">¥{p.avg_unit_cost?.toFixed(0) || '—'}</span>
                              </button>
                            ))}
                            <button type="button"
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-orange-500/10 text-orange-400 border-t border-gray-600"
                              onPointerDown={() => { updateLine(idx, 'product_id', '__new__'); updateLine(idx, 'search', ''); updateLine(idx, 'showDropdown', false); }}>
                              + 新建商品
                            </button>
                            {filtered.length === 0 && line.search && (
                              <div className="px-3 py-1.5 text-xs text-[#6b7085]">无匹配，可新建</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {poolLines.length > 1 && (
                    <button type="button" className="text-[#6b7085] hover:text-red-400 text-xs px-1 shrink-0"
                      onClick={() => removeLine(idx)}>✕</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input className="input text-xs w-16 text-center" type="text" inputmode="decimal" placeholder="数量"
                    value={line.quantity || ''}
                    onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                  <span className="text-[10px] text-[#6b7085] flex-1 leading-tight">
                    {ref.refUnit > 0 ? (
                      <>参考 ¥{ref.refUnit.toFixed(0)}/件 = ¥{ref.refCost.toFixed(0)}{allocated > 0 ? <><br/>实摊 ¥{allocated.toFixed(0)}</> : ''}</>
                    ) : line.product_id ? (
                      <span className="text-[#4b5065]">新品 · 无参考均价</span>
                    ) : null}
                  </span>
                </div>
              </div>
            );
          })}

          <button type="button" className="text-[11px] text-accent font-medium hover:text-white border border-accent/40 rounded-lg px-3 py-1.5 w-full bg-accent/5 hover:bg-accent/10"
            onClick={addLine}>＋ 添加商品行</button>

          {totalQty > 0 && (
            <div className="text-[10px] text-[#6b7085] space-y-0.5 pt-1 border-t border-white/5">
              <div className="flex justify-between">
                <span>分配 {totalQty} / 原 {toyQty} 件</span>
                <span>参考总成本 ¥{totalRefCost.toFixed(0)}</span>
              </div>
              {totalCost > 0 && totalRefCost > 0 && (
                <div className="text-accent">
                  分摊（比例 {(ratio * 100).toFixed(0)}%）：{linesWithRef.filter(l => l.refCost > 0 && l.qty > 0).map(l => {
                    const a = Math.round(l.refCost * ratio * 100) / 100;
                    return `${l.prod?.name_zh || '?'} ¥${a.toFixed(0)}`;
                  }).join(' · ')}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">确认入池</button>
            <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── 售出弹窗 ─── */
function SellModal({ toy, onConfirm, onCancel }) {
  const { shippingRules, supplies } = useStore();
  const boxSupplies = supplies.filter(s => s.category === 'box');

  // 售出时一次性按 sell_price 算出 4 项平台费作为初始值；用户可在表单里自由修改
  const initSoftware = (toy.sell_price || 0) * 0.01;
  const initBasic = (toy.sell_price || 0) * 0.006;
  const initWorryFree = toy.worry_free_service_fee || 0;
  const initHuabei = toy.huabei || 0;

  const [form, setForm] = useState({
    sell_price: toy.sell_price || '',
    dispute_fee: '',
    bao_you: toy.logistics_fee > 0 || toy.box_fee > 0 || toy.packing_fee > 0 ? true : false,
    carrier: toy.logistics_fee > 0 ? 'zto' : '',
    logistics_region: toy.logistics_region || '',
    logistics_weight: toy.logistics_weight || '',
    selected_boxes: [],
    software_service_fee: initSoftware,
    basic_software_service_fee: initBasic,
    worry_free_service_fee: initWorryFree,
    huabei: initHuabei,
  });

  const [calcLogisticsFee, setCalcLogisticsFee] = useState(toy.logistics_fee || 0);
  const [calcBoxFee, setCalcBoxFee] = useState(toy.box_fee || 0);
  const [packingFee, setPackingFee] = useState(toy.packing_fee || 0);

  // 售价变化 → 自动重算平台费
  useEffect(() => {
    const price = +form.sell_price || 0;
    setForm(f => ({
      ...f,
      software_service_fee: Math.round(price * 0.01 * 100) / 100,
      basic_software_service_fee: Math.round(price * 0.006 * 100) / 100,
    }));
  }, [form.sell_price]);

  // 重量或地区变化 → 中通自动查运费
  useEffect(() => {
    if (!form.bao_you || form.carrier !== 'zto' || !form.logistics_region || !form.logistics_weight) {
      setCalcLogisticsFee(0);
      return;
    }
    const w = parseFloat(form.logistics_weight) || 0;
    if (w <= 0) { setCalcLogisticsFee(0); return; }
    api.get(`/shipping-rules/calculate?province=${encodeURIComponent(form.logistics_region)}&weight=${w}`)
      .then(r => setCalcLogisticsFee(r.fee || 0))
      .catch(() => setCalcLogisticsFee(0));
  }, [form.logistics_region, form.logistics_weight, form.bao_you, form.carrier]);

  // carrier 切换 → 顺丰清零
  useEffect(() => {
    if (form.carrier === 'sf') setCalcLogisticsFee(0);
  }, [form.carrier]);

  // 箱型勾选变化 → 自动算箱规费
  useEffect(() => {
    const total = form.selected_boxes.reduce((sum, id) => {
      const s = boxSupplies.find(b => b.id === id);
      return sum + (s ? s.unit_price : 0);
    }, 0);
    setCalcBoxFee(total);
  }, [form.selected_boxes, boxSupplies]);

  const toggleBox = (id) => {
    setForm(f => ({
      ...f,
      selected_boxes: f.selected_boxes.includes(id)
        ? f.selected_boxes.filter(b => b !== id)
        : [...f.selected_boxes, id]
    }));
  };

  const price = +form.sell_price || 0;
  const softwareFee = +form.software_service_fee || 0;
  const basicFee = +form.basic_software_service_fee || 0;
  const worryFreeFee = +form.worry_free_service_fee || 0;
  const huabeiFee = +form.huabei || 0;
  const disputeFee = +form.dispute_fee || 0;
  const totalFees = softwareFee + basicFee + worryFreeFee + huabeiFee;
  const totalLogistics = form.bao_you ? (calcLogisticsFee + calcBoxFee + packingFee) : 0;
  const netProfit = price - totalFees - totalLogistics - disputeFee - toy.total_cost;

  const nextStatus = toy.status === 'stock' ? 'sold' : toy.status;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      sell_price: price,
      software_service_fee: Math.round(softwareFee * 100) / 100,
      basic_software_service_fee: Math.round(basicFee * 100) / 100,
      worry_free_service_fee: Math.round(worryFreeFee * 100) / 100,
      huabei: Math.round(huabeiFee * 100) / 100,
      logistics_fee: form.bao_you ? calcLogisticsFee : 0,
      logistics_region: form.bao_you ? form.logistics_region : '',
      logistics_weight: form.bao_you ? (parseFloat(form.logistics_weight) || 0) : 0,
      box_fee: form.bao_you ? calcBoxFee : 0,
      packing_fee: form.bao_you ? packingFee : 0,
      status: nextStatus,
      sell_date: toy.sell_date || new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold">出售 {toy.name_zh || toy.name}</h3>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {/* 售出价格 */}
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">售出价格 (¥)</label>
            <input className="input" type="text" inputmode="decimal" placeholder="输入售价" value={form.sell_price}
              onChange={e => setForm({ ...form, sell_price: e.target.value })} autoFocus />
          </div>

          {/* 包邮开关（仅在库时显示） */}
          {toy.status === 'stock' && (
            <div className="bg-black/20 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-orange-500"
                  checked={form.bao_you}
                  onChange={e => {
                    const checked = e.target.checked;
                    setForm(f => ({ ...f, bao_you: checked, carrier: checked ? (f.carrier || 'zto') : '' }));
                    if (!checked) { setCalcLogisticsFee(0); }
                  }} />
                <span className="text-xs text-[#d0d4e8]">包邮（买家无需支付运费）</span>
              </label>

              {/* 包邮内容 */}
              {form.bao_you && (
                <>
                  {/* 快递选择 */}
                  <div>
                    <label className="text-[10px] text-[#6b7085] block mb-1">快递平台</label>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, carrier: 'zto' }))}
                        className={`text-xs px-3 py-1.5 rounded border flex-1 transition-colors ${
                          form.carrier === 'zto'
                            ? 'border-orange-500 bg-orange-500/20 text-[#d0d4e8]'
                            : 'border-white/10 text-[#6b7085]'
                        }`}>
                        中通
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, carrier: 'sf' }))}
                        className={`text-xs px-3 py-1.5 rounded border flex-1 transition-colors ${
                          form.carrier === 'sf'
                            ? 'border-orange-500 bg-orange-500/20 text-[#d0d4e8]'
                            : 'border-white/10 text-[#6b7085]'
                        }`}>
                        顺丰（待设置）
                      </button>
                    </div>
                  </div>

                  {/* 中通：地区 + 重量 */}
                  {form.carrier === 'zto' && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#6b7085] block mb-1">目的地省份</label>
                          <select className="input text-xs" value={form.logistics_region}
                            onChange={e => setForm(f => ({ ...f, logistics_region: e.target.value }))}>
                            <option value="">— 选择省份 —</option>
                            {shippingRules.flatMap(r =>
                              (r.provinces || '').split(',').map(p => p.trim()).filter(Boolean).map(p => (
                                <option key={`${r.id}-${p}`} value={p}>{p}（{r.name}）</option>
                              ))
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#6b7085] block mb-1">重量 (kg)</label>
                          <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.1" placeholder="0"
                            value={form.logistics_weight}
                            onChange={e => setForm(f => ({ ...f, logistics_weight: e.target.value }))} />
                        </div>
                      </div>

                      {/* 估算快递费 */}
                      <div className="flex justify-between text-xs">
                        <span className="text-[#6b7085]">快递费估算</span>
                        <span className="text-[#d0d4e8] font-bold">¥{calcLogisticsFee.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {/* 顺丰：待设置提示 */}
                  {form.carrier === 'sf' && (
                    <div className="text-[10px] text-[#6b7085] italic">顺丰计价规则待录入，暂时手动填写下方费用</div>
                  )}

                  {/* 箱型勾选 */}
                  {boxSupplies.length > 0 && (
                    <div>
                      <label className="text-[10px] text-[#6b7085] block mb-1">选择箱型</label>
                      <div className="flex flex-wrap gap-1.5">
                        {boxSupplies.map(s => (
                          <button key={s.id} type="button" onClick={() => toggleBox(s.id)}
                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                              form.selected_boxes.includes(s.id)
                                ? 'border-orange-500 bg-orange-500/20 text-[#d0d4e8]'
                                : 'border-white/10 text-[#6b7085]'
                            }`}>
                            {s.name} ¥{s.unit_price}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-[#6b7085]">箱规费合计</span>
                        <span className="text-[#d0d4e8]">¥{calcBoxFee.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* 打包费（手动填） */}
                  <div>
                    <label className="text-[10px] text-[#6b7085] block mb-1">打包费 (¥)</label>
                    <input className="input text-xs" type="text" inputmode="decimal" min="0" placeholder="0"
                      value={packingFee || ''}
                      onChange={e => setPackingFee(+e.target.value || 0)} />
                  </div>

                  {/* 物流小计 */}
                  <div className="border-t border-white/5 pt-1.5 flex justify-between text-xs font-bold text-[#d0d4e8]">
                    <span>物流支出合计</span>
                    <span>¥{(calcLogisticsFee + calcBoxFee + packingFee).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 平台扣费明细（可编辑） */}
          <div className="bg-black/30 rounded-lg p-3 space-y-2 text-xs">
            <div className="text-[10px] text-[#6b7085] font-bold mb-1">平台扣费明细（可手动改实际扣款）</div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-0.5">软件服务费（1%）</label>
              <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                value={form.software_service_fee} onChange={e => setForm({ ...form, software_service_fee: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-0.5">基础软件服务费（0.6%）</label>
              <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                value={form.basic_software_service_fee} onChange={e => setForm({ ...form, basic_software_service_fee: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-0.5">无忧卖服务费（2.5%，默认 0）</label>
              <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                value={form.worry_free_service_fee} onChange={e => setForm({ ...form, worry_free_service_fee: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-0.5">花呗扣款（3%，默认 0）</label>
              <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                value={form.huabei} onChange={e => setForm({ ...form, huabei: e.target.value })} />
            </div>
            <div className="border-t border-white/5 pt-1.5 flex justify-between font-bold text-[#d0d4e8]">
              <span>扣费合计</span>
              <span>¥{totalFees.toFixed(2)}</span>
            </div>
          </div>

          {/* 纠纷退款（可选） */}
          {(toy.status === 'sold' || toy.status === 'done') && (
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">纠纷退款 (¥)（可选）</label>
              <input className="input" type="text" inputmode="decimal" placeholder="如有纠纷退款，填写金额"
                value={form.dispute_fee}
                onChange={e => setForm({ ...form, dispute_fee: e.target.value })} />
            </div>
          )}

          {/* 预计利润 */}
          {price > 0 && (
            <div className="bg-black/20 rounded-lg p-3 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6b7085]">预计利润</span>
                <span className={`text-base font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netProfit >= 0 ? '+' : ''}¥{netProfit.toFixed(2)}
                </span>
              </div>
              {totalLogistics > 0 && (
                <div className="text-[9px] text-[#6b7085] text-right">含物流支出 ¥{totalLogistics.toFixed(2)}</div>
              )}
              {disputeFee > 0 && (
                <div className="text-[9px] text-[#6b7085] text-right">含纠纷退款 ¥{disputeFee}</div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              {toy.status === 'stock' ? '确认出售' : '保存售价'}
            </button>
            <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── 录入历史销售 ─── */
function HistoricalSaleModal({ onCancel, categories }) {
  const { addToy, setToast } = useStore();
  const [form, setForm] = useState({
    name: '',
    category: '',
    source: '',
    sell_price: '',
    sell_date: new Date().toISOString().slice(0, 10),
    include_worry_free: false,
    include_huabei: false,
  });

  const price = +form.sell_price || 0;
  const softwareFee = Math.round(price * 0.01 * 100) / 100;
  const basicFee = Math.round(price * 0.006 * 100) / 100;
  const worryFreeFee = form.include_worry_free ? Math.round(price * 0.025 * 100) / 100 : 0;
  const huabeiFee = form.include_huabei ? Math.round(price * 0.03 * 100) / 100 : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setToast('请填写名称');
    if (price <= 0) return setToast('请填写售价');
    try {
      await addToy({
        name: form.name.trim(),
        category: form.category || '其他',
        source: form.source || 'direct',
        sell_price: price,
        sell_date: form.sell_date,
        status: 'done',
        procurement_stage: null,
        software_service_fee: softwareFee,
        basic_software_service_fee: basicFee,
        worry_free_service_fee: worryFreeFee,
        huabei: huabeiFee,
        purchase_date: form.sell_date,
        notes: '历史销售',
      });
      setToast('已录入');
      onCancel();
    } catch (e) {
      setToast('录入失败: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold">录入历史销售</h3>
          <p className="text-[10px] text-[#6b7085] mt-1">快速补录一笔已售出商品的出售记录。购入价留空，对账时到「已售」tab 点编辑补 stage1/2/3 即可。</p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">商品名称 *</label>
            <input className="input" placeholder="例: M1号巴尔坦" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">品类</label>
              <select className="input text-xs" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">未指定</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.parent_id ? '└ ' : ''}{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">来源</label>
              <select className="input text-xs" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                <option value="">未指定</option>
                <option value="direct">直购</option>
                <option value="proxy">代购</option>
                <option value="secondhand">二手</option>
                <option value="domestic">国内</option>
                <option value="海淘-任你购">海淘·任你购</option>
                <option value="海淘-任意门">海淘·任意门</option>
                <option value="海淘-乐淘一番">海淘·乐淘一番</option>
                <option value="代购-四人帮">代购·四人帮</option>
                <option value="代购-W">代购·W</option>
                <option value="代购-Z">代购·Z</option>
                <option value="其他代购">其他代购</option>
                <option value="咸鱼">咸鱼</option>
                <option value="vx好友">vx好友</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">售出价格 * (¥)</label>
              <input className="input" type="text" inputmode="decimal" placeholder="0" value={form.sell_price}
                onChange={e => setForm({ ...form, sell_price: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">卖出日</label>
              <input className="input text-xs" type="date" value={form.sell_date}
                onChange={e => setForm({ ...form, sell_date: e.target.value })} />
            </div>
          </div>

          <div className="bg-black/30 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="text-[10px] text-[#6b7085] mb-1">平台费（自动按售价算）</div>
            <div className="flex justify-between text-[#6b7085]"><span>软件服务费 (1%)</span><span>¥{softwareFee.toFixed(2)}</span></div>
            <div className="flex justify-between text-[#6b7085]"><span>基础软件服务费 (0.6%)</span><span>¥{basicFee.toFixed(2)}</span></div>
            <div className="border-t border-white/5 my-1" />
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-1.5 cursor-pointer flex-1">
                <input type="checkbox" className="accent-orange-500"
                  checked={form.include_worry_free}
                  onChange={e => setForm({ ...form, include_worry_free: e.target.checked })} />
                <span>无忧卖服务费 (2.5%)</span>
              </label>
              <span className={form.include_worry_free ? 'text-[#d0d4e8]' : 'text-[#6b7085]'}>¥{worryFreeFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-1.5 cursor-pointer flex-1">
                <input type="checkbox" className="accent-orange-500"
                  checked={form.include_huabei}
                  onChange={e => setForm({ ...form, include_huabei: e.target.checked })} />
                <span>花呗扣款 (3%)</span>
              </label>
              <span className={form.include_huabei ? 'text-[#d0d4e8]' : 'text-[#6b7085]'}>¥{huabeiFee.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">确认录入</button>
            <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── 编辑弹窗 ─── */
function EditModal({ toy, onConfirm, onCancel, categories }) {
  const [form, setForm] = useState({
    name: toy.name || '',
    category: toy.category || '',
    notes: toy.notes || '',
    stage1_amount: toy.stage1_amount ?? '',
    stage2_amount: toy.stage2_amount ?? '',
    stage2_handling: toy.stage2_handling ?? '',
    stage2_domestic_ship: toy.stage2_domestic_ship ?? '',
    stage3_intl_ship: toy.stage3_intl_ship ?? '',
    stage3_tax: toy.stage3_tax ?? ((toy.stage3_amount || 0) - (toy.stage3_intl_ship || 0)) || '',
    stage3_tax_mode: toy.stage3_tax_mode || 'normal',
    sell_price: toy.sell_price ?? '',
    sell_date: toy.sell_date || '',
    return_cost: toy.return_cost ?? '',
    logistics_fee: toy.logistics_fee ?? '',
    box_fee: toy.box_fee ?? '',
    packing_fee: toy.packing_fee ?? '',
    software_service_fee: toy.software_service_fee ?? '',
    basic_software_service_fee: toy.basic_software_service_fee ?? '',
    worry_free_service_fee: toy.worry_free_service_fee ?? '',
    huabei: toy.huabei ?? '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const updates = { name: form.name.trim(), category: form.category, notes: form.notes };
    if (form.stage1_amount !== '') updates.stage1_amount = +form.stage1_amount;
    // 阶段 2：拆分手续费 / 国内物流；总额由两者自动求和
    const s2h = form.stage2_handling === '' ? 0 : +form.stage2_handling;
    const s2s = form.stage2_domestic_ship === '' ? 0 : +form.stage2_domestic_ship;
    updates.stage2_handling = s2h;
    updates.stage2_domestic_ship = s2s;
    updates.stage2_amount = s2h + s2s;
    if (form.stage3_intl_ship !== '' || form.stage3_tax !== '') {
      const ship = form.stage3_intl_ship === '' ? 0 : +form.stage3_intl_ship;
      updates.stage3_intl_ship = ship;
      updates.stage3_tax_mode = form.stage3_tax_mode || 'normal';
      // 包税线路强制 0 税（与 Procurement 推进弹窗的 computeStage3Tax 同源）
      const tax = (form.stage3_tax_mode === 'tax_included' && sourceGroup(toy.source) !== 'proxy')
        ? 0
        : (form.stage3_tax === '' ? 0 : +form.stage3_tax);
      updates.stage3_tax = tax;
      updates.stage3_amount = ship + tax;
    }
    updates.stage3_tax_mode = form.stage3_tax_mode || 'normal';
    // 售价编辑：仅 sold/done 状态可修改
    if ((toy.status === 'sold' || toy.status === 'done') && form.sell_price !== '') {
      updates.sell_price = +form.sell_price;
      updates.sell_date = form.sell_date || toy.sell_date || new Date().toISOString().slice(0, 10);
    }
    if (form.return_cost !== '') updates.return_cost = +form.return_cost;
    if (form.logistics_fee !== '') updates.logistics_fee = +form.logistics_fee;
    if (form.box_fee !== '') updates.box_fee = +form.box_fee;
    if (form.packing_fee !== '') updates.packing_fee = +form.packing_fee;
    // 平台扣费：仅 sold/done 状态可修改
    if (toy.status === 'sold' || toy.status === 'done') {
      updates.software_service_fee = form.software_service_fee === '' ? 0 : +form.software_service_fee;
      updates.basic_software_service_fee = form.basic_software_service_fee === '' ? 0 : +form.basic_software_service_fee;
      updates.worry_free_service_fee = form.worry_free_service_fee === '' ? 0 : +form.worry_free_service_fee;
      updates.huabei = form.huabei === '' ? 0 : +form.huabei;
    }
    onConfirm(toy.id, updates);
  };

  const totalCost = (toy.total_cost || 0) + (toy.return_cost || 0);
  const profit = toy.sell_price
    ? toy.sell_price - totalCost
      - (toy.software_service_fee || 0)
      - (toy.basic_software_service_fee || 0)
      - (toy.worry_free_service_fee || 0)
      - (toy.huabei || 0)
      - (toy.refund_amount || 0)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold">编辑 {toy.name_zh || toy.name}</h3>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">商品名称</label>
            <input className="input text-xs" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">品类</label>
            <select className="input text-xs" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">选择分类</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.parent_id ? '└ ' : ''}{c.name}</option>)}
            </select>
          </div>

          {/* 阶段成本（可编辑） */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">①买价</label>
              <input className="input text-xs" type="text" inputmode="decimal" placeholder="0" value={form.stage1_amount} onChange={e => setForm({ ...form, stage1_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">②转运</label>
              <input className="input text-xs" type="text" inputmode="decimal" placeholder="0" value={form.stage2_amount} onChange={e => setForm({ ...form, stage2_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">③国际运费</label>
              <input className="input text-xs" type="text" inputmode="decimal" placeholder="0" value={form.stage3_intl_ship} onChange={e => setForm({ ...form, stage3_intl_ship: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">③税费</label>
              <input className="input text-xs" type="text" inputmode="decimal" placeholder="0" value={form.stage3_tax} onChange={e => setForm({ ...form, stage3_tax: e.target.value })} />
            </div>
            {sourceGroup(toy.source) !== 'proxy' && (
              <div className="col-span-2 mt-1">
                <label className="text-[10px] text-[#6b7085] block mb-1">运输方式</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 text-xs py-1.5 rounded border ${form.stage3_tax_mode === 'normal' ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-black/20 border-white/10 text-[#6b7085]'}`}
                    onClick={() => setForm({ ...form, stage3_tax_mode: 'normal' })}
                  >
                    正常运输（13%税）
                  </button>
                  <button
                    type="button"
                    className={`flex-1 text-xs py-1.5 rounded border ${form.stage3_tax_mode === 'tax_included' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-black/20 border-white/10 text-[#6b7085]'}`}
                    onClick={() => setForm({ ...form, stage3_tax_mode: 'tax_included', stage3_tax: 0 })}
                  >
                    包税线路（无税）
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 已完成/已发货：展示完整费用明细 */}
          {(toy.status === 'sold' || toy.status === 'done') && (
            <>
              {/* 购入成本明细（可编辑） */}
              <div className="bg-black/20 rounded-lg p-3 space-y-2 text-xs">
                <div className="text-[10px] text-[#6b7085] font-bold mb-1">购入成本明细</div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5">①买价</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.stage1_amount} onChange={e => setForm({ ...form, stage1_amount: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5 pl-2">②手续费</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.stage2_handling} onChange={e => setForm({ ...form, stage2_handling: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5 pl-2">②国内物流费</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.stage2_domestic_ship} onChange={e => setForm({ ...form, stage2_domestic_ship: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5 pl-2">③国际运费</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.stage3_intl_ship} onChange={e => setForm({ ...form, stage3_intl_ship: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5 pl-2">③税费</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.stage3_tax} onChange={e => setForm({ ...form, stage3_tax: e.target.value })} />
                </div>
                <div className="border-t border-white/5 pt-1.5 flex justify-between font-bold text-[#d0d4e8]">
                  <span>成本合计</span>
                  <span>¥{totalCost.toFixed(2)}</span>
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5">退换货成本</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.return_cost} onChange={e => setForm({ ...form, return_cost: e.target.value })} />
                </div>
              </div>

              {/* 平台扣费明细（可编辑） */}
              <div className="bg-black/20 rounded-lg p-3 space-y-2 text-xs">
                <div className="text-[10px] text-[#6b7085] font-bold mb-1">平台扣费明细</div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5">软件服务费（1%）</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.software_service_fee} onChange={e => setForm({ ...form, software_service_fee: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5">基础软件服务费（0.6%）</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.basic_software_service_fee} onChange={e => setForm({ ...form, basic_software_service_fee: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5">无忧卖服务费（2.5%）</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.worry_free_service_fee} onChange={e => setForm({ ...form, worry_free_service_fee: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-0.5">花呗扣款（3%）</label>
                  <input className="input text-xs" type="text" inputmode="decimal" min="0" step="0.01" placeholder="0"
                    value={form.huabei} onChange={e => setForm({ ...form, huabei: e.target.value })} />
                </div>
              </div>

              {/* 物流支出明细（可编辑） */}
              {(toy.logistics_fee > 0 || toy.box_fee > 0 || toy.packing_fee > 0) && (
                <div className="bg-black/20 rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="text-[10px] text-[#6b7085] font-bold mb-1">物流支出</div>
                  {toy.logistics_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">快递费</span><span className="text-[#d0d4e8]">¥{toy.logistics_fee}</span></div>}
                  {toy.box_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">箱规费</span><span className="text-[#d0d4e8]">¥{toy.box_fee}</span></div>}
                  {toy.packing_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">打包费</span><span className="text-[#d0d4e8]">¥{toy.packing_fee}</span></div>}
                  <div className="border-t border-white/5 pt-1.5 flex justify-between font-bold"><span className="text-[#6b7085]">物流合计</span><span className="text-[#d0d4e8]">¥{(toy.logistics_fee + toy.box_fee + toy.packing_fee).toFixed(2)}</span></div>
                </div>
              )}

              {/* 售价（可编辑） */}
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">售出价格 (¥)</label>
                <input className="input text-xs" type="text" inputmode="decimal" placeholder="0" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">售出日期</label>
                <input className="input text-xs" type="date" value={form.sell_date} onChange={e => setForm({ ...form, sell_date: e.target.value })} />
              </div>

              {/* 利润汇总（只读） */}
              {profit !== null && (
                <div className={`rounded-lg p-3 text-center font-bold text-lg ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  style={{ background: profit >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)' }}>
                  {profit >= 0 ? '+' : ''}¥{profit.toFixed(2)}
                  <div className="text-[10px] font-normal text-[#6b7085] mt-0.5">预计利润</div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">备注</label>
            <input className="input text-xs" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {toy.return_cost > 0 && (
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">退换货成本 (¥)</label>
              <input className="input text-xs" type="text" inputmode="decimal" placeholder="0" value={form.return_cost} onChange={e => setForm({ ...form, return_cost: e.target.value })} />
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 text-xs">保存</button>
            <button type="button" className="btn-ghost text-xs" onClick={onCancel}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── 退换货弹窗 ─── */
function ReturnModal({ toy, onConfirm, onCancel }) {
  const [form, setForm] = useState({
    return_cost: toy.return_cost || '',
    return_note: '',
  });
  const cost = +form.return_cost || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      ...toy,
      status: 'stock',
      sell_price: null,
      software_service_fee: null,
      basic_software_service_fee: null,
      worry_free_service_fee: null,
      huabei: null,
      sell_date: null,
      return_cost: (toy.return_cost || 0) + cost,
      notes: form.return_note ? (toy.notes ? toy.notes + ' | ' + form.return_note : form.return_note) : toy.notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-xs space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold">退换货 {toy.name_zh || toy.name}</h3>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">回收成本 (¥)</label>
            <input
              className="input"
              type="text" inputmode="decimal"
              placeholder="退货产生的运费/打包费等"
              value={form.return_cost}
              onChange={e => setForm({ ...form, return_cost: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">备注</label>
            <input
              className="input text-xs"
              placeholder="退换货原因等"
              value={form.return_note}
              onChange={e => setForm({ ...form, return_note: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 text-xs">确认退换</button>
            <button type="button" className="btn-ghost text-xs" onClick={onCancel}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── 池商品售出弹窗 ─── */
function PoolSellModal({ group, onConfirm, onCancel, shippingRules, supplies, preselectedBatchId }) {
  const boxSupplies = supplies.filter(s => s.category === 'box');
  const avgCost = group.totalQty > 0 ? group.totalCost / group.totalQty : 0;

  const [form, setForm] = useState({
    toy_id: preselectedBatchId ? String(preselectedBatchId) : '',
    quantity: '1',
    sell_price: '',
    bao_you: false,
    carrier: 'zto',
    logistics_region: '',
    logistics_weight: '',
    selected_boxes: [],
    software_service_fee: 0,
    basic_software_service_fee: 0,
    worry_free_service_fee: 0,
    huabei: 0,
  });
  const [calcLogisticsFee, setCalcLogisticsFee] = useState(0);
  const [calcBoxFee, setCalcBoxFee] = useState(0);
  const [packingFee, setPackingFee] = useState(0);

  const selectedBatch = form.toy_id ? group.batches.find(b => b.id === Number(form.toy_id)) : null;
  const maxQty = selectedBatch ? selectedBatch.remaining : group.totalRemaining;
  const qty = Math.min(Number(form.quantity) || 1, maxQty);
  const price = Number(form.sell_price) || 0;
  const totalRevenue = price * qty;

  useEffect(() => { setForm(f => ({ ...f, quantity: String(Math.min(Number(f.quantity) || 1, maxQty)) })); }, [maxQty]);

  useEffect(() => {
    const p = +form.sell_price || 0;
    setForm(f => ({
      ...f,
      software_service_fee: Math.round(p * qty * 0.01 * 100) / 100,
      basic_software_service_fee: Math.round(p * qty * 0.006 * 100) / 100,
    }));
  }, [form.sell_price, qty]);

  useEffect(() => {
    if (!form.bao_you || form.carrier !== 'zto' || !form.logistics_region || !form.logistics_weight) {
      setCalcLogisticsFee(0);
      return;
    }
    const w = parseFloat(form.logistics_weight) || 0;
    if (w <= 0) { setCalcLogisticsFee(0); return; }
    api.get(`/shipping-rules/calculate?province=${encodeURIComponent(form.logistics_region)}&weight=${w}`)
      .then(r => setCalcLogisticsFee(r.fee || 0))
      .catch(() => setCalcLogisticsFee(0));
  }, [form.logistics_region, form.logistics_weight, form.bao_you, form.carrier]);

  useEffect(() => { if (form.carrier === 'sf') setCalcLogisticsFee(0); }, [form.carrier]);

  useEffect(() => {
    const total = form.selected_boxes.reduce((sum, id) => {
      const s = boxSupplies.find(b => b.id === id);
      return sum + (s ? s.unit_price : 0);
    }, 0);
    setCalcBoxFee(total);
  }, [form.selected_boxes, boxSupplies]);

  const toggleBox = (id) => {
    setForm(f => ({
      ...f,
      selected_boxes: f.selected_boxes.includes(id)
        ? f.selected_boxes.filter(b => b !== id)
        : [...f.selected_boxes, id]
    }));
  };

  const softwareFee = +form.software_service_fee || 0;
  const basicFee = +form.basic_software_service_fee || 0;
  const worryFreeFee = +form.worry_free_service_fee || 0;
  const huabeiFee = +form.huabei || 0;
  const totalFees = softwareFee + basicFee + worryFreeFee + huabeiFee;
  const totalLogistics = form.bao_you ? (calcLogisticsFee + calcBoxFee + packingFee) : 0;
  const batchUnitCost = selectedBatch ? (selectedBatch.unit_cost || 0) : avgCost;
  const estimatedProfit = totalRevenue - totalFees - totalLogistics - (batchUnitCost * qty);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!price) return;
    onConfirm({
      product_id: group.product_id,
      toy_id: form.toy_id ? Number(form.toy_id) : null,
      quantity: qty,
      sell_price: price,
      total_revenue: totalRevenue,
      software_service_fee: Math.round(softwareFee * 100) / 100,
      basic_software_service_fee: Math.round(basicFee * 100) / 100,
      worry_free_service_fee: Math.round(worryFreeFee * 100) / 100,
      huabei: Math.round(huabeiFee * 100) / 100,
      logistics_fee: form.bao_you ? calcLogisticsFee : 0,
      logistics_region: form.bao_you ? form.logistics_region : '',
      logistics_weight: form.bao_you ? (parseFloat(form.logistics_weight) || 0) : 0,
      box_fee: form.bao_you ? calcBoxFee : 0,
      packing_fee: form.bao_you ? packingFee : 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-orange-500/20 p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold">出售 {group.product?.name_zh || group.product?.name || '池商品'}</h3>
        <div className="text-xs text-[#6b7085]">库存 {group.totalRemaining} 件 · 均价 ¥{avgCost.toFixed(0)} · {group.batches.length} 批次</div>

        <div>
          <label className="text-[10px] text-[#6b7085] block mb-1">指定批次（可选，不选则 FIFO 自动扣）</label>
          <select className="input text-xs" value={form.toy_id}
            onChange={e => setForm({ ...form, toy_id: e.target.value })}>
            <option value="">— 全部批次（FIFO）—</option>
            {group.batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name_zh || b.name} · 剩{b.remaining}/{b.quantity} · ¥{(b.unit_cost || 0).toFixed(0)}/件 · {b.purchase_date || b.created_at?.slice(0, 10)}
              </option>
            ))}
          </select>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">卖出数量</label>
              <input className="input text-xs" type="text" inputmode="decimal" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">单价 (¥)</label>
              <input className="input text-xs" type="text" inputmode="decimal" placeholder="0"
                value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} />
            </div>
          </div>

          {qty > 0 && price > 0 && (
            <div className="text-xs text-[#6b7085]">总价: <span className="text-[#d0d4e8] font-bold">¥{totalRevenue.toFixed(2)}</span></div>
          )}

          {/* 物流 */}
          <div className="bg-black/20 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-orange-500"
                checked={form.bao_you}
                onChange={e => {
                  const checked = e.target.checked;
                  setForm(f => ({ ...f, bao_you: checked, carrier: checked ? (f.carrier || 'zto') : '' }));
                  if (!checked) setCalcLogisticsFee(0);
                }} />
              <span className="text-xs text-[#d0d4e8]">包邮</span>
            </label>
            {form.bao_you && (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, carrier: 'zto' }))}
                    className={`text-xs px-3 py-1.5 rounded border flex-1 ${form.carrier === 'zto' ? 'border-orange-500 bg-orange-500/20' : 'border-white/10'}`}>中通</button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, carrier: 'sf' }))}
                    className={`text-xs px-3 py-1.5 rounded border flex-1 ${form.carrier === 'sf' ? 'border-orange-500 bg-orange-500/20' : 'border-white/10'}`}>顺丰</button>
                </div>
                {form.carrier === 'zto' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select className="input text-xs" value={form.logistics_region}
                      onChange={e => setForm(f => ({ ...f, logistics_region: e.target.value }))}>
                      <option value="">省份</option>
                      {shippingRules.flatMap(r => (r.provinces||'').split(',').map(p=>p.trim()).filter(Boolean).map(p=>(<option key={p} value={p}>{p}</option>)))}
                    </select>
                    <input className="input text-xs" type="text" inputmode="decimal" placeholder="重量kg" value={form.logistics_weight}
                      onChange={e => setForm(f => ({ ...f, logistics_weight: e.target.value }))} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 平台费 */}
          <div className="bg-black/30 rounded-lg p-3 space-y-2 text-xs">
            <div className="text-[10px] text-[#6b7085]">软件服务费 1%</div>
            <input className="input text-xs" type="text" inputmode="decimal" value={form.software_service_fee}
              onChange={e => setForm({ ...form, software_service_fee: e.target.value })} />
            <div className="text-[10px] text-[#6b7085]">基础服务费 0.6%</div>
            <input className="input text-xs" type="text" inputmode="decimal" value={form.basic_software_service_fee}
              onChange={e => setForm({ ...form, basic_software_service_fee: e.target.value })} />
          </div>

          {price > 0 && qty > 0 && (
            <div className={`text-right text-sm font-bold ${estimatedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              预计利润 {estimatedProfit >= 0 ? '+' : ''}¥{estimatedProfit.toFixed(2)}
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">确认出售</button>
            <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Warehouse() {
  const { toys, updateToy, deleteToy, setToast, shippingRules, supplies } = useStore();
  const [filter, setFilter] = useState('stock');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selling, setSelling] = useState(null);
  const [editing, setEditing] = useState(null);
  const [returning, setReturning] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingUnsell, setPendingUnsell] = useState(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [poolSelling, setPoolSelling] = useState(null);
  const [poolifying, setPoolifying] = useState(null);
  const [unpoolifying, setUnpoolifying] = useState(null);
  const [batchUnpoolifying, setBatchUnpoolifying] = useState(null);
  const [viewingPool, setViewingPool] = useState(null);

  useEffect(() => {
    api.get('/settings/categories').then(data => setCategories(data.flat || data)).catch(() => {});
    api.get('/products').then(prods => setProducts(prods)).catch(() => {});
  }, []);

  const [page, setPage] = useState(1);
  const [sortNewest, setSortNewest] = useState(true);
  const PAGE_SIZE = 12;

  const filtered = toys.filter(t => {
    if (t.status !== filter) return false;
    if (sourceFilter && t.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name?.toLowerCase().includes(q) && !t.name_zh?.toLowerCase().includes(q) && !t.category?.toLowerCase().includes(q)) return false;
    }
    if (t.status === 'procurement' || t.status === 'transit' || t.status === 'preorder') return false;
    if (t.product_id != null && t.status === 'stock') return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = a.purchase_date || a.created_at || '';
    const db = b.purchase_date || b.created_at || '';
    return sortNewest ? db.localeCompare(da) : da.localeCompare(db);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 搜素/切 tab 重置页码
  useEffect(() => { setPage(1); }, [filter, search, sourceFilter]);

  const handleSell = async (updates) => {
    try {
      await updateToy(selling.id, { ...selling, ...updates });
      setSelling(null);
    } catch (e) {
      setToast('出售失败: ' + e.message);
    }
  };

  const handleReturn = (toy) => {
    setReturning(toy);
  };

  const confirmReturn = async (updates) => {
    await updateToy(returning.id, updates);
    setReturning(null);
  };

  const handleEdit = async (id, updates) => {
    const toy = toys.find(t => t.id === id);
    await updateToy(id, { ...toy, ...updates });
    setEditing(null);

    // 自动入池：有分类但未入池的，自动匹配已有池或新建
    const newCat = updates.category || toy?.category;
    if (!toy?.product_id && newCat) {
      try {
        const existing = await api.get(`/products?category=${encodeURIComponent(newCat)}`);
        let pid;
        if (existing.length > 0) {
          pid = existing[0].id;
        } else {
          const created = await api.post('/products', {
            name: newCat,
            name_zh: toy.name_zh || toy.name || newCat,
            category: newCat,
            source: toy.source || 'direct',
          });
          pid = created.id;
        }
        const tc = toy.total_cost || 0;
        await updateToy(id, { product_id: pid, quantity: 1, remaining: 1, unit_cost: tc });
      } catch (_) { /* 入池失败不影响编辑 */ }
    }
  };

  // 池模式卖出
  const handlePoolSell = async (formData) => {
    try {
      await api.post('/sales', formData);
      setPoolSelling(null);
      setToast('已售出');
      // 刷新 products 列表
      api.get('/products').then(prods => setProducts(prods)).catch(() => {});
      // 刷新 toys（通过 loadAll 或直接重新拉取）
      const { loadAll } = useStore.getState();
      loadAll();
    } catch (e) {
      setToast('出售失败: ' + (e.message || JSON.stringify(e)));
    }
  };

  // 入池操作
  const handlePoolify = async (formData) => {
    try {
      const { lines, totalCost, totalRefCost } = formData;
      const ratio = totalRefCost > 0 ? totalCost / totalRefCost : 0;

      // 第一行：更新原始 toy
      const first = lines[0];
      let productId = first.product_id;
      // 新建商品
      const prod = products.find(p => p.id === productId);
      if (!prod) {
        const created = await api.post('/products', {
          name: poolifying.name,
          name_zh: poolifying.name_zh || '',
          category: poolifying.category,
          source: poolifying.source,
        });
        productId = created.id;
      }
      const firstRefCost = (() => {
        const p = products.find(p => p.id === first.product_id);
        const refUnit = p?.avg_unit_cost || 0;
        return refUnit * first.quantity;
      })();
      const firstAllocated = ratio > 0 ? Math.round(firstRefCost * ratio * 100) / 100 : 0;
      const firstUnitCost = first.quantity > 0 ? firstAllocated / first.quantity : 0;

      await updateToy(poolifying.id, {
        ...poolifying,
        product_id: productId,
        quantity: first.quantity,
        remaining: first.quantity,
        total_cost: firstAllocated,
        unit_cost: Math.round(firstUnitCost * 100) / 100,
      });

      // 其余行：创建新的 toy 记录
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let pid = line.product_id;
        const lp = products.find(p => p.id === pid);
        if (!lp) {
          const created = await api.post('/products', {
            name: poolifying.name,
            name_zh: poolifying.name_zh || '',
            category: poolifying.category,
            source: poolifying.source,
          });
          pid = created.id;
        }
        const refCost = (() => {
          const p = products.find(p => p.id === line.product_id);
          const refUnit = p?.avg_unit_cost || 0;
          return refUnit * line.quantity;
        })();
        const allocated = ratio > 0 ? Math.round(refCost * ratio * 100) / 100 : 0;
        const unitCost = line.quantity > 0 ? allocated / line.quantity : 0;

        await api.post('/toys', {
          name: poolifying.name,
          name_zh: poolifying.name_zh || '',
          category: poolifying.category,
          source: poolifying.source,
          status: 'stock',
          procurement_stage: 'stocked',
          product_id: pid,
          quantity: line.quantity,
          remaining: line.quantity,
          total_cost: allocated,
          unit_cost: Math.round(unitCost * 100) / 100,
          stage1_amount: allocated,
          purchase_date: poolifying.purchase_date || new Date().toISOString().slice(0, 10),
          image: poolifying.image || null,
        });
      }

      setPoolifying(null);
      setToast(lines.length > 1 ? `已拆分入池：${lines.length} 个商品` : '已转入池模式');
      api.get('/products').then(prods => setProducts(prods)).catch(() => {});
      const { loadAll } = useStore.getState();
      loadAll();
    } catch (e) {
      setToast('入池失败: ' + (e.message || ''));
    }
  };

  // 退池操作
  const handleUnpoolify = async () => {
    try {
      await updateToy(unpoolifying.id, {
        ...unpoolifying,
        product_id: null,
        quantity: null,
        remaining: null,
        unit_cost: null,
      });
      setUnpoolifying(null);
      setToast('已退出池模式');
      api.get('/products').then(prods => setProducts(prods)).catch(() => {});
    } catch (e) {
      setToast('退池失败: ' + (e.message || ''));
    }
  };

  // 批量退池操作
  const handleBatchUnpoolify = async () => {
    if (!batchUnpoolifying || batchUnpoolifying.length === 0) return;
    let done = 0;
    let fail = 0;
    for (const b of batchUnpoolifying) {
      try {
        await updateToy(b.id, {
          ...b,
          product_id: null,
          quantity: null,
          remaining: null,
          unit_cost: null,
        });
        done++;
      } catch (e) {
        fail++;
      }
    }
    setBatchUnpoolifying(null);
    setToast(`批量退池完成：${done} 件成功${fail > 0 ? `，${fail} 件失败` : ''}`);
    api.get('/products').then(prods => setProducts(prods)).catch(() => {});
  };

  // 分离池商品和传统商品（仅看 stock 状态）
  const poolToys = toys.filter(t => t.product_id != null && t.status === 'stock' && t.remaining > 0);
  const legacyToys = toys.filter(t => t.product_id == null);

  // 按 product_id 聚合池商品
  const poolGrouped = (() => {
    const map = {};
    for (const t of poolToys) {
      if (!map[t.product_id]) map[t.product_id] = { batches: [], totalRemaining: 0, totalQty: 0, totalCost: 0 };
      map[t.product_id].batches.push(t);
      map[t.product_id].totalRemaining += t.remaining || 0;
      map[t.product_id].totalQty += t.quantity || 0;
      map[t.product_id].totalCost += t.total_cost || 0;
    }
    return Object.entries(map).map(([pid, data]) => {
      const prod = products.find(p => p.id === Number(pid));
      return { product_id: Number(pid), product: prod, ...data };
    });
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="order-2 md:order-1">
          <h2 className="text-lg font-bold">仓库</h2>
          <p className="text-xs text-[#6b7085]">{sorted.length} 件单品{totalPages > 1 ? ` · 第${page}/${totalPages}页` : ''}</p>
        </div>
        <button
          className="btn-primary text-sm order-1 md:order-2 shrink-0"
          onClick={() => setShowHistorical(true)}
        >
          + 录入历史销售
        </button>
      </div>

      {/* ─── 池商品区域 ─── */}
      {poolGrouped.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-orange-500" />
            <h3 className="text-sm font-bold">池商品</h3>
            <span className="text-[10px] text-[#6b7085]">{poolGrouped.length} 款 · 库存 {poolGrouped.reduce((s,g) => s+g.totalRemaining,0)} 件</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {poolGrouped.map(g => {
              const prod = g.product;
              const avgCost = g.totalQty > 0 ? g.totalCost / g.totalQty : 0;
              return (
                <div key={g.product_id} className="card border border-orange-500/20 cursor-pointer"
                  onClick={() => setViewingPool(g)}>
                  <div className="flex items-start gap-3 mb-2">
                    {prod?.image && <img src={prod.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-white/5" loading="lazy" onError={e => e.target.style.display='none'} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{prod?.name_zh || prod?.name || '未命名'}</div>
                      <div className="text-[10px] text-[#6b7085]">{prod?.category || ''} · {g.batches.length} 批次</div>
                    </div>
                    <span className="text-lg font-bold text-accent shrink-0 ml-2">{g.totalRemaining}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#6b7085] mb-2">
                    <span>均价 ¥{avgCost.toFixed(0)}</span>
                    <span>总成本 ¥{g.totalCost.toFixed(0)}</span>
                  </div>
                  <div className="text-[9px] text-[#6b7085] mb-2">
                    共 {g.totalQty} 件 · 在库 {g.totalRemaining} 件
                  </div>

                  <button
                    className="btn-primary w-full text-sm py-2 mt-2"
                    onClick={e => { e.stopPropagation(); setPoolSelling(g); }}
                  >
                    出售
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 单品区域 ─── */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-4 rounded-full bg-white/20" />
        <h3 className="text-sm font-bold">单品</h3>
      </div>

      <input
        className="input"
        placeholder="🔍 搜索单品..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="flex gap-2 flex-wrap items-center">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${filter === f.key ? 'bg-accent text-[#0f1117] font-semibold' : 'bg-white/5 text-[#6b7085] hover:bg-white/10'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <select
          className="input text-xs w-32"
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
        >
          <option value="">全部来源</option>
          {SOURCES.map(s => (
            <option key={s} value={s}>{sourceLabel(s)}</option>
          ))}
        </select>
        <button
          className="btn-ghost text-xs px-2 py-1.5 ml-auto"
          onClick={() => { setSortNewest(!sortNewest); setPage(1); }}
        >
          {sortNewest ? '↓ 最新' : '↑ 最早'}
        </button>
      </div>

      {/* 顶部翻页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-1">
          <button className="btn-ghost text-xs px-3 py-1" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>◀ 上一页</button>
          <span className="text-xs text-[#6b7085]">{page} / {totalPages}</span>
          <button className="btn-ghost text-xs px-3 py-1" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>下一页 ▶</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {paged.map(toy => (
          <ToyCard
            key={toy.id}
            toy={toy}
            onSell={toy => setSelling(toy)}
            onEdit={toy => setEditing(toy)}
            onReturn={toy => setReturning(toy)}
            onDone={id => updateToy(id, { ...toys.find(t => t.id === id), status: 'done' })}
            onUnsell={id => setPendingUnsell(id)}
            onDelete={id => setPendingDelete(id)}
            onPoolify={toy => setPoolifying(toy)}
          />
        ))}
      </div>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            className="btn-ghost text-xs px-3 py-1.5"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ◀ 上一页
          </button>
          <span className="text-xs text-[#6b7085]">{page} / {totalPages}</span>
          <button
            className="btn-ghost text-xs px-3 py-1.5"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            下一页 ▶
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[#6b7085] text-sm">没有匹配的商品</div>
      )}

      {selling && (
        <SellModal
          toy={selling}
          onConfirm={handleSell}
          onCancel={() => setSelling(null)}
        />
      )}

      {editing && (
        <EditModal
          toy={editing}
          categories={categories}
          onConfirm={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}

      {showHistorical && (
        <HistoricalSaleModal
          categories={categories}
          onCancel={() => setShowHistorical(false)}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="删除商品"
          message={`确认删除「${pendingDelete}」吗？此操作不可恢复。`}
          onConfirm={async () => { await deleteToy(pendingDelete); setPendingDelete(null); setEditing(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {pendingUnsell && (
        <ConfirmModal
          title="退回仓库"
          message="确定将此商品退回仓库？售价和平台费将被清空。"
          onConfirm={async () => {
            const t = toys.find(t => t.id === pendingUnsell);
            if (t) {
              await updateToy(pendingUnsell, {
                ...t,
                status: 'stock',
                procurement_stage: 'stocked',
                sell_price: null,
                sell_date: null,
                software_service_fee: null,
                basic_software_service_fee: null,
                worry_free_service_fee: null,
                huabei: null,
                logistics_fee: null,
                logistics_region: null,
                logistics_weight: null,
                box_fee: null,
                packing_fee: null,
              });
            }
            setPendingUnsell(null);
          }}
          onCancel={() => setPendingUnsell(null)}
        />
      )}

      {returning && (
        <ReturnModal
          toy={returning}
          onConfirm={confirmReturn}
          onCancel={() => setReturning(null)}
        />
      )}

      {poolSelling && (
        <PoolSellModal
          group={poolSelling}
          preselectedBatchId={poolSelling.preselectedBatchId || null}
          onConfirm={handlePoolSell}
          onCancel={() => setPoolSelling(null)}
          shippingRules={shippingRules || []}
          supplies={supplies || []}
        />
      )}

      {unpoolifying && (
        <ConfirmModal
          title="退出池模式"
          message={`确定将「${unpoolifying.name_zh || unpoolifying.name}」退出池模式吗？\n数量、均价信息将被清空，恢复为普通单品。`}
          onConfirm={handleUnpoolify}
          onCancel={() => setUnpoolifying(null)}
        />
      )}

      {batchUnpoolifying && batchUnpoolifying.length > 0 && (
        <ConfirmModal
          title="批量退出池模式"
          message={`确定将以下 ${batchUnpoolifying.length} 件商品退出池模式吗？\n\n${batchUnpoolifying.map(b => '· ' + (b.name_zh || b.name)).join('\n')}\n\n数量、均价信息将被清空，恢复为普通单品。`}
          onConfirm={handleBatchUnpoolify}
          onCancel={() => setBatchUnpoolifying(null)}
        />
      )}

      {poolifying && (
        <PoolifyModal
          toy={poolifying}
          products={products}
          onConfirm={handlePoolify}
          onCancel={() => setPoolifying(null)}
        />
      )}

      {viewingPool && (
        <PoolDetailModal
          group={viewingPool}
          onClose={() => setViewingPool(null)}
          onSell={(g, batchId) => { setViewingPool(null); setPoolSelling({ ...g, preselectedBatchId: batchId }); }}
          onUnpoolify={(b) => { setViewingPool(null); setUnpoolifying(b); }}
          onBatchUnpoolify={(batches) => { setViewingPool(null); setBatchUnpoolifying(batches); }}
        />
      )}
    </div>
  );
}
