import { useState, useEffect, memo, useCallback } from 'react';
import useStore from '../stores/useStore';
import { api } from '../lib/api';
import { useIsTouchDevice } from '../lib/useIsTouchDevice';
import { sourceLabel, sourceGroup, SOURCE_CATEGORIES, toSourceValue, parseSource } from '../lib/sources';
import ConfirmModal from '../components/ConfirmModal';

const STAGES = ['stage1', 'stage2', 'stage3'];
const STAGE_NAMES = { stage1: '买货中', stage2: '国内转运', stage3: '国际运输' };
const STAGE_LABELS = { stage1: '①', stage2: '②', stage3: '③' };
const STAGE_COLORS = { stage1: '#f0a030', stage2: '#60a5fa', stage3: '#a78bfa' };

const TABS = [
  { key: 'all', label: '全部', color: '#a0a4b8' },
  { key: 'preorder', label: '📌 预购', color: '#f472b6' },
  { key: 'stage1', label: '① 买货中', color: STAGE_COLORS.stage1 },
  { key: 'stage2', label: '② 国内转运', color: STAGE_COLORS.stage2 },
  { key: 'stage3', label: '③ 国际运输', color: STAGE_COLORS.stage3 },
];

const ARRIVAL_WARN_DAYS = 3;

/** 代购费已含税，不再叠加 13% 消费税；直购/二手照常 */
/** taxMode='tax_included'（包税线路）→ 0 */
function computeStage3Tax(stage1Amount, source, taxMode = 'normal') {
  if (sourceGroup(source) === 'proxy') return 0;
  if (taxMode === 'tax_included') return 0;
  return Math.round((stage1Amount || 0) * 0.13 * 100) / 100;
}

/** 计算到货提示：{ days, label, tone } | null */
function getArrivalInfo(expectedDate) {
  if (!expectedDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expectedDate + 'T00:00:00');
  const days = Math.round((target - today) / 86400000);
  if (days < 0)  return { days, label: `逾期 ${-days} 天`, tone: 'overdue' };
  if (days === 0) return { days, label: '今日到货',     tone: 'soon' };
  if (days <= ARRIVAL_WARN_DAYS) return { days, label: `${days} 天后到货`, tone: 'soon' };
  return { days, label: `${days} 天后到货`, tone: 'ok' };
}

const ARRIVAL_TONE = {
  overdue: { bar: 'border-l-red-500',  bg: 'bg-red-500/10',  text: 'text-red-300',   border: 'border-red-500/40' },
  soon:    { bar: 'border-l-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-300', border: 'border-yellow-500/40' },
  ok:      { bar: 'border-l-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-300', border: 'border-emerald-500/30' },
};

function ArrivalBadge({ info }) {
  if (!info) return null;
  const t = ARRIVAL_TONE[info.tone];
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${t.bg} ${t.text} ${t.border}`}>
      {info.label}
    </span>
  );
}

function StageChip({ stage }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: STAGE_COLORS[stage] + '22', color: STAGE_COLORS[stage] }}>
      {STAGE_LABELS[stage]} {STAGE_NAMES[stage]}
    </span>
  );
}

function PreorderChip() {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30">
      📌 预购
    </span>
  );
}

/* 阶段推进弹窗 */
function StageAdvanceModal({ toy, allToys, onConfirm, onCancel }) {
  const isTouch = useIsTouchDevice();
  const current = toy.procurement_stage; // 'stage1' | 'stage2'
  const next = current === 'stage1' ? 'stage2' : 'stage3';
  const isS2 = next === 'stage2';
  const isS3 = next === 'stage3';

  const [stage2_handling, setStage2_handling] = useState(toy.stage2_handling ?? 5);
  const [stage2_domestic_ship, setStage2_domestic_ship] = useState(toy.stage2_domestic_ship ?? '');
  const [stage3_intl_ship, setStage3_intl_ship] = useState(toy.stage3_intl_ship ?? '');
  const [stage3_tax_mode, setStage3_tax_mode] = useState(toy.stage3_tax_mode || 'normal');
  const [weight, setWeight] = useState(toy.logistics_weight ?? '');
  const [total_ship_fee, setTotal_ship_fee] = useState('');

  const batchCandidates = (allToys || []).filter(t =>
    t.id !== toy.id &&
    t.source === 'direct' &&
    t.procurement_stage === 'stage2'
  );

  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleItem = (id) => {
    setSelectedIds(s => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  };

  const tax = computeStage3Tax(toy.stage1_amount, toy.source, toy.stage3_tax_mode);
  const stage2Total = (stage2_handling || 0) + (stage2_domestic_ship || 0);
  const allSelected = [toy, ...(allToys || []).filter(t => selectedIds.has(t.id))];
  const totalWeight = allSelected.reduce((s, t) => s + (t.logistics_weight || 0), 0);
  const shipFee = parseFloat(total_ship_fee) || 0;

  function calcShare(t) {
    if (!isS3 || totalWeight <= 0 || shipFee <= 0) return 0;
    return Math.round((t.logistics_weight || 0) / totalWeight * shipFee * 100) / 100;
  }

  const currentShare = calcShare(toy);
  const currentTax = computeStage3Tax(toy.stage1_amount, toy.source, stage3_tax_mode);
  const currentS3Total = currentShare + currentTax;

  const handleConfirm = async () => {
    if (isS2) {
      const updates = {
        procurement_stage: 'stage2',
        stage2_handling,
        stage2_domestic_ship,
        stage2_amount: stage2Total,
        logistics_weight: parseFloat(weight) || 0,
      };
      await onConfirm(toy.id, { ...toy, ...updates });
      return;
    }

    if (isS3) {
      const batch = allSelected.map(t => {
        const share = calcShare(t);
        // 同批次共享运输方式（一条线发货）
        const tTaxMode = stage3_tax_mode;
        const tTax = computeStage3Tax(t.stage1_amount, t.source, tTaxMode);
        return {
          ...t,
          procurement_stage: 'stage3',
          stage3_intl_ship: share,
          stage3_tax: tTax,
          stage3_amount: share + tTax,
          stage3_tax_mode: tTaxMode,
        };
      });
      for (const item of batch) {
        await onConfirm(item.id, item);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 w-full max-w-sm p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: STAGE_COLORS[next] }}>
            推进到{STAGE_LABELS[next]}阶段
          </span>
          <span className="text-xs text-[#6b7085]">— {toy.name_zh || toy.name}</span>
        </div>

        {isS2 && sourceGroup(toy.source) !== 'domestic' && (
          <>
            <p className="text-xs text-[#6b7085]">填写日本境内产生的费用：</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">重量 (kg)</label>
                <input className="input text-xs" type="text" inputmode={isTouch ? "decimal" : undefined} lang="zh-CN" min="0" step="0.1" value={weight ?? ''} placeholder="0" onChange={e => setWeight(e.target.value === '' ? '' : +e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">手续费 (¥)</label>
                <input className="input text-xs" type="text" inputmode={isTouch ? "decimal" : undefined} lang="zh-CN" min="0" value={stage2_handling ?? ''} placeholder="5" onChange={e => setStage2_handling(e.target.value === '' ? '' : +e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">国内物流费 (¥)</label>
                <input className="input text-xs" type="text" inputmode={isTouch ? "decimal" : undefined} lang="zh-CN" min="0" value={stage2_domestic_ship ?? ''} placeholder="0" onChange={e => setStage2_domestic_ship(e.target.value === '' ? '' : +e.target.value)} />
              </div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center">
              <span className="text-[10px] text-[#6b7085]">阶段②小计：</span>
              <span className="ml-2 text-sm font-bold text-[#d0d4e8]">¥{stage2Total.toFixed(2)}</span>
            </div>
          </>
        )}
        {isS2 && sourceGroup(toy.source) === 'domestic' && (
          <>
            <p className="text-xs text-[#6b7085]">填写国内运费：</p>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">国内运费 (¥)</label>
              <input className="input text-xs" type="text" inputmode={isTouch ? "decimal" : undefined} lang="zh-CN" min="0" value={stage2_domestic_ship ?? ''} placeholder="0" onChange={e => setStage2_domestic_ship(e.target.value === '' ? '' : +e.target.value)} />
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center mt-3">
              <span className="text-[10px] text-[#6b7085]">阶段②小计：</span>
              <span className="ml-2 text-sm font-bold text-[#d0d4e8]">¥{(stage2_domestic_ship || 0).toFixed(2)}</span>
            </div>
          </>
        )}

        {isS3 && (
          <>
            {batchCandidates.length > 0 && (
              <div>
                <p className="text-[10px] text-[#6b7085] mb-1">勾选同批次直购商品（已在②阶段），一起分摊运费：</p>
                <div className="space-y-1 max-h-32 overflow-y-auto bg-black/20 rounded-lg p-2">
                  {batchCandidates.map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white/5 rounded px-1 py-0.5">
                      <input type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleItem(t.id)}
                        className="accent-orange-500" />
                      <span className="flex-1 truncate text-[#d0d4e8]">{t.name_zh || t.name}</span>
                      {t.logistics_weight > 0
                        ? <span className="text-[#6b7085]">{t.logistics_weight}kg</span>
                        : <span className="text-red-400 text-[9px]">未填重量</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">
                整批总国际运费 (¥){selectedIds.size > 0 && <span className="text-orange-400">（含 {selectedIds.size + 1} 件）</span>}
              </label>
              <input className="input text-xs" type="text" inputmode={isTouch ? "decimal" : undefined} lang="zh-CN" min="0" value={total_ship_fee} placeholder="0"
                onChange={e => setTotal_ship_fee(e.target.value)} />
            </div>

            {sourceGroup(toy.source) !== 'proxy' && (
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">运输方式</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 text-xs py-2 rounded-lg border ${stage3_tax_mode === 'normal' ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-black/20 border-white/10 text-[#6b7085]'}`}
                    onClick={() => setStage3_tax_mode('normal')}
                  >
                    正常运输（13%税）
                  </button>
                  <button
                    type="button"
                    className={`flex-1 text-xs py-2 rounded-lg border ${stage3_tax_mode === 'tax_included' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-black/20 border-white/10 text-[#6b7085]'}`}
                    onClick={() => setStage3_tax_mode('tax_included')}
                  >
                    包税线路（无税）
                  </button>
                </div>
              </div>
            )}

            <div className="bg-black/30 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-[#6b7085]">分摊重量</span><span className="text-[#d0d4e8]">{toy.logistics_weight || 0}kg / {totalWeight}kg</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#6b7085]">国际运费分摊</span><span className="text-[#d0d4e8]">¥{currentShare.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs">
                <span className="text-[#6b7085]">{stage3_tax_mode === 'tax_included' ? '税费（包税线路已含）' : '税费（买价×13%）'}</span>
                <span className="text-[#d0d4e8]">¥{currentTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-white/5 pt-1 font-bold"><span className="text-[#6b7085]">阶段③小计</span><span className="text-accent">¥{currentS3Total.toFixed(2)}</span></div>
            </div>

            {selectedIds.size > 0 && totalWeight > 0 && shipFee > 0 && (
              <div className="bg-black/20 rounded-lg p-2 space-y-0.5">
                <p className="text-[10px] text-[#6b7085] mb-1">其他商品分摊：</p>
                {[...selectedIds].map(id => {
                  const t = (allToys || []).find(x => x.id === id);
                  if (!t) return null;
                  const share = calcShare(t);
                  const tTax = computeStage3Tax(t.stage1_amount, t.source, stage3_tax_mode);
                  return (
                    <div key={id} className="flex justify-between text-[10px]">
                      <span className="text-[#6b7085] truncate flex-1">{t.name_zh || t.name}</span>
                      <span className="text-[#d0d4e8] ml-2">¥{share.toFixed(2)}{tTax > 0 ? ` + ¥${tTax.toFixed(2)}税` : ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="flex gap-2">
          <button className="btn-primary flex-1 text-xs" onClick={handleConfirm}>确认推进</button>
          <button className="btn-ghost text-xs" onClick={onCancel}>取消</button>
        </div>
      </div>

    </div>
  );
}

function EditToyModal({ toy, form, setForm, categories, onSave, onCancel }) {
  const isTouch = useIsTouchDevice();
  const isPreorder = toy.status === 'preorder';

  const handleSave = async () => {
    const updates = { ...form };
    if (toy.procurement_stage === 'stage2' || toy.procurement_stage === 'stage3') {
      updates.stage2_amount = (updates.stage2_handling || 0) + (updates.stage2_domestic_ship || 0);
    }
    if (toy.procurement_stage === 'stage3') {
      updates.stage3_tax = computeStage3Tax(updates.stage1_amount, toy.source, updates.stage3_tax_mode || toy.stage3_tax_mode);
      updates.stage3_amount = (updates.stage3_intl_ship || 0) + updates.stage3_tax;
    }
    await onSave(updates);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-start justify-center p-4 overflow-y-auto" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-4 w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-4 truncate">{toy.name_zh || toy.name}</h3>

        {!isPreorder && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-black/20 rounded-lg p-3 border border-[#f0a030]/20">
              <div className="text-[10px] font-bold text-[#f0a030] mb-2">① 买货</div>
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">买价 (¥)</label>
                <input className="input text-xs" type="text" inputMode={isTouch ? "decimal" : undefined} lang="zh-CN" value={form.stage1_amount ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage1_amount: e.target.value === '' ? '' : +e.target.value })} />
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-[#60a5fa]/20">
              <div className="text-[10px] font-bold text-[#60a5fa] mb-2">② 国内转运</div>
              <div className="space-y-2">
                {sourceGroup(toy.source) === 'direct' && (
                  <div>
                    <label className="text-[10px] text-[#6b7085] block mb-1">重量 (kg)</label>
                    <input className="input text-xs" type="text" inputMode={isTouch ? "decimal" : undefined} lang="zh-CN" min="0" step="0.1" value={form.logistics_weight ?? ''} placeholder="0" onChange={e => setForm({ ...form, logistics_weight: e.target.value === '' ? '' : +e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-1">手续费 (¥)</label>
                  <input className="input text-xs" type="text" inputMode={isTouch ? "decimal" : undefined} lang="zh-CN" value={form.stage2_handling ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage2_handling: e.target.value === '' ? '' : +e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-1">国内物流费 (¥)</label>
                  <input className="input text-xs" type="text" inputMode={isTouch ? "decimal" : undefined} lang="zh-CN" value={form.stage2_domestic_ship ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage2_domestic_ship: e.target.value === '' ? '' : +e.target.value })} />
                </div>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-3 border border-[#a78bfa]/20">
              <div className="text-[10px] font-bold text-[#a78bfa] mb-2">③ 国际运输</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-1">国际运费 (¥)</label>
                  <input className="input text-xs" type="text" inputMode={isTouch ? "decimal" : undefined} lang="zh-CN" value={form.stage3_intl_ship ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage3_intl_ship: e.target.value === '' ? '' : +e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-1">税费 (¥，13%)</label>
                  <input className="input text-xs bg-black/20 cursor-default" type="text" inputMode={isTouch ? "decimal" : undefined} lang="zh-CN" value={computeStage3Tax(form.stage1_amount, toy.source, form.stage3_tax_mode || toy.stage3_tax_mode).toFixed(2)} readOnly />
                </div>
                {sourceGroup(toy.source) !== 'proxy' && (
                  <div className="flex gap-1 pt-1">
                    <button
                      type="button"
                      className={`flex-1 text-[10px] py-1 rounded border ${(form.stage3_tax_mode || toy.stage3_tax_mode) === 'normal' ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-black/20 border-white/10 text-[#6b7085]'}`}
                      onClick={() => setForm({ ...form, stage3_tax_mode: 'normal' })}
                    >
                      正常运输
                    </button>
                    <button
                      type="button"
                      className={`flex-1 text-[10px] py-1 rounded border ${(form.stage3_tax_mode || toy.stage3_tax_mode) === 'tax_included' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-black/20 border-white/10 text-[#6b7085]'}`}
                      onClick={() => setForm({ ...form, stage3_tax_mode: 'tax_included' })}
                    >
                      包税线路
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">商品名称</label>
            <input className="input text-xs" lang="zh-CN" spellCheck={false} autoComplete="off" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">品类</label>
            <select className="input text-xs" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">选择分类</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.parent_id ? '└ ' : ''}{c.name}</option>)}
            </select>
          </div>
        </div>

        {isPreorder && (
          <div className="mb-3">
            <label className="text-[10px] text-[#6b7085] block mb-1">上市/到货日 <span className="text-[#6b7085]">(可选)</span></label>
            <input className="input text-xs" type="date" value={form.expected_arrival_date || ''} onChange={e => setForm({ ...form, expected_arrival_date: e.target.value })} />
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-[#6b7085] block mb-1">备注</label>
            <input className="input text-xs" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button className="btn-primary text-xs" onClick={handleSave}>保存</button>
          <button className="btn-ghost text-xs" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}

const ToyRow = memo(function ToyRow({ toy, onUpdate, onDelete, categories, allToys, batchMode, selected, onToggleSelect }) {
  const isTouch = useIsTouchDevice();
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [advancingTo, setAdvancingTo] = useState(null);
  const [form, setForm] = useState(toy);

  const totalCost = toy.total_cost || 0;
  const isPreorder = toy.status === 'preorder';
  // 只有预购才高亮「预计到货日」；采购中靠 stage 流程追踪
  const arrival = isPreorder ? getArrivalInfo(toy.expected_arrival_date) : null;
  const arrivalTone = arrival ? ARRIVAL_TONE[arrival.tone] : null;

  const handleEditSave = async (updates) => {
    await onUpdate(toy.id, updates);
    setEditing(false);
  };

  const handleAdvanceConfirm = async (id, updates) => {
    await onUpdate(id, updates);
    setAdvancingTo(null);
  };

  const handleConvertToProcurement = async () => {
    await onUpdate(toy.id, {
      ...toy,
      status: 'procurement',
      procurement_stage: 'stage1',
    });
  };

  const [editingPreorderAmount, setEditingPreorderAmount] = useState(false);
  const [preorderAmountInput, setPreorderAmountInput] = useState(toy.stage1_amount || '');
  const savePreorderAmount = async () => {
    const v = preorderAmountInput === '' ? 0 : +preorderAmountInput;
    await onUpdate(toy.id, { ...toy, stage1_amount: v });
    setEditingPreorderAmount(false);
  };

  const stage2SubLabel = (toy.stage2_handling > 0 || toy.stage2_domestic_ship > 0)
    ? `手续费¥${toy.stage2_handling} + 物流¥${toy.stage2_domestic_ship}`
    : null;

  return (
    <>
      {advancingTo && (
        <StageAdvanceModal
          toy={toy}
          allToys={allToys}
          onConfirm={handleAdvanceConfirm}
          onCancel={() => setAdvancingTo(null)}
        />
      )}

      <div className={`card mb-3 border-l-4 ${arrivalTone ? arrivalTone.bar : 'border-l-transparent'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {batchMode && <input type="checkbox" className="shrink-0 mt-1 accent-orange-500" checked={selected} onChange={() => onToggleSelect(toy.id)} />}
            {toy.image && <img src={toy.image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-white/5" loading="lazy" onError={e => e.target.style.display='none'} />}
            <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-bold truncate">{toy.name_zh || toy.name}</span>
              {isPreorder ? <PreorderChip /> : <StageChip stage={toy.procurement_stage} />}
              <ArrivalBadge info={arrival} />
            </div>
            <div className="text-[10px] text-[#6b7085] flex gap-2 flex-wrap">
              {isPreorder ? (
                <>
                  <span>创建 {toy.created_at?.slice(0, 10) || toy.purchase_date}</span>
                  {toy.expected_arrival_date
                    ? <span>· 上市/到货 {toy.expected_arrival_date}</span>
                    : <span className="text-pink-300/80">· 上市日未定</span>}
                </>
              ) : (
                <span>购入 {toy.purchase_date || toy.created_at?.slice(0, 10)}</span>
              )}
            </div>
            </div>
          </div>
          <div className="text-right">
            {isPreorder ? (
              editingPreorderAmount ? (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <input
                    className="input text-xs w-24 text-right"
                    type="text" inputmode={isTouch ? "decimal" : undefined} lang="zh-CN"
                    value={preorderAmountInput}
                    placeholder="已付金额"
                    onChange={e => setPreorderAmountInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') savePreorderAmount(); if (e.key === 'Escape') setEditingPreorderAmount(false); }}
                    autoFocus
                  />
                  <button className="text-xs text-pink-300 px-1" onClick={savePreorderAmount}>✓</button>
                </div>
              ) : toy.stage1_amount > 0 ? (
                <div className="cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); setEditingPreorderAmount(true); setPreorderAmountInput(toy.stage1_amount); }} title="点击修改金额">
                  <div className="text-lg font-bold text-pink-300">¥{toy.stage1_amount.toFixed(0)}</div>
                  <div className="text-[9px] text-[#6b7085]">已付 (未到货)</div>
                </div>
              ) : (
                <div className="cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); setEditingPreorderAmount(true); setPreorderAmountInput(''); }} title="点击填写已付金额">
                  <div className="text-lg font-bold text-pink-300">📌</div>
                  <div className="text-[9px] text-[#6b7085]">未到货 · 点填金额</div>
                </div>
              )
            ) : (
              <>
                <div className="text-lg font-bold text-accent">¥{totalCost.toFixed(0)}</div>
                <div className="text-[9px] text-[#6b7085]">总成本</div>
              </>
            )}
          </div>
        </div>

        {/* Stage breakdown (仅 procurement) */}
        {!isPreorder && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-black/20 rounded-lg p-2 text-center">
              <div className="text-[9px] text-[#6b7085] mb-1">① 买货</div>
              <div className="text-sm font-bold text-[#d0d4e8]">¥{toy.stage1_amount || 0}</div>
              {toy.source && <div className="text-[9px] text-[#6b7085] mt-0.5">{sourceLabel(toy.source)}</div>}
            </div>
            <div className={`rounded-lg p-2 text-center ${toy.stage2_amount > 0 ? 'bg-black/20' : 'bg-black/10 border border-dashed border-white/10'}`}>
              <div className="text-[9px] text-[#6b7085] mb-1">② 国内转运</div>
              <div className="text-sm font-bold text-[#d0d4e8]">¥{toy.stage2_amount || 0}</div>
              {stage2SubLabel && <div className="text-[8px] text-[#6b7085] mt-0.5 truncate">{stage2SubLabel}</div>}
            </div>
            <div className={`rounded-lg p-2 text-center ${toy.stage3_amount > 0 ? 'bg-black/20' : 'bg-black/10 border border-dashed border-white/10'}`}>
              <div className="text-[9px] text-[#6b7085] mb-1">③ 国际运输</div>
              <div className="text-sm font-bold text-[#d0d4e8]">¥{toy.stage3_amount || 0}</div>
              {toy.stage3_tax > 0 && <div className="text-[8px] text-[#6b7085] mt-0.5">含税 ¥{toy.stage3_tax}</div>}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {isPreorder && (
            <button
              className="btn-primary flex-1 text-xs"
              onClick={handleConvertToProcurement}
              title="把这条预购转为采购中，从阶段①开始"
            >
              ▶ 转为采购中
            </button>
          )}
          {!isPreorder && toy.procurement_stage === 'stage1' && (
            <button className="btn-primary flex-1 text-xs" onClick={() => setAdvancingTo('stage2')}>
              推进到②国内转运
            </button>
          )}
          {!isPreorder && toy.procurement_stage === 'stage2' && sourceGroup(toy.source) !== 'domestic' && (
            <button className="btn-primary flex-1 text-xs" onClick={() => setAdvancingTo('stage3')}>
              推进到③国际运输
            </button>
          )}
          {!isPreorder && toy.procurement_stage === 'stage3' && (
            <button
              className="btn-primary flex-1 text-xs bg-green-600"
              onClick={() => onUpdate(toy.id, { ...toy, status: 'stock', procurement_stage: 'stocked' })}
            >
              ✓ 确认入库
            </button>
          )}
          {!isPreorder && toy.procurement_stage === 'stage2' && sourceGroup(toy.source) === 'domestic' && (
            <button
              className="btn-primary flex-1 text-xs bg-green-600"
              onClick={() => onUpdate(toy.id, { ...toy, status: 'stock', procurement_stage: 'stocked' })}
            >
              ✓ 确认入库
            </button>
          )}
          <button className="btn-ghost text-xs" onClick={() => { setEditing(!editing); if (!editing) setForm(toy); }}>
            {editing ? '取消' : '编辑'}
          </button>
          <button className="btn-ghost text-xs text-red-400" onClick={() => setPendingDelete(toy.id)}>删除</button>
        </div>

        {/* Edit modal */}
        {editing && (
          <EditToyModal
            toy={toy}
            form={form}
            setForm={setForm}
            categories={categories}
            onSave={handleEditSave}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>
      {pendingDelete !== null && (
        <ConfirmModal
          message="确定删除这件商品？"
          onConfirm={() => { onDelete(pendingDelete); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
});

export default function Procurement() {
  const isTouch = useIsTouchDevice();
  const { toys, suppliers, addToy, updateToy, deleteToy, deleteToys, setToast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [batchStockinConfirm, setBatchStockinConfirm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('all');
  const [poolMode, setPoolMode] = useState(false);
  const [poolLines, setPoolLines] = useState([{ product_id: null, quantity: '', custom_name: '', manual_price: '' }]);
  const [form, setForm] = useState({
    name: '', category: '其他', source: 'direct', status: 'procurement', procurement_stage: 'stage1',
    stage1_amount: '', stage2_amount: '', stage3_amount: '',
    stage1_date: new Date().toISOString().slice(0, 10),
    expected_arrival_date: '',
    product_id: null, quantity: '',
  });

  const inProcurement = toys.filter(t =>
    t.status === 'preorder' ||
    ['procurement', 'transit'].includes(t.status) ||
    (t.procurement_stage && !['stocked'].includes(t.procurement_stage))
  );

  const filteredList = tab === 'all'
    ? inProcurement
    : tab === 'preorder'
      ? inProcurement.filter(t => t.status === 'preorder')
      : inProcurement.filter(t => t.procurement_stage === tab);

  useEffect(() => {
    api.get('/settings/categories').then(data => setCategories(data.flat || data)).catch(() => {});
    api.get('/products').then(prods => setProducts(prods)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return setToast('请填写名称');
    try {
      const body = { ...form };
      if (body.status === 'preorder') {
        body.procurement_stage = null;
        body.stage1_amount = body.stage1_amount === '' || body.stage1_amount == null ? 0 : +body.stage1_amount;
      }
      if (!poolMode) { body.product_id = null; if (!body.quantity) body.quantity = 1; }
      // 池模式：支持多行拆分
      if (poolMode) {
        const validLines = poolLines.filter(l => l.product_id && (Number(l.quantity) || 0) > 0);
        if (validLines.length === 0) return setToast('请至少选择一件商品并填写数量');
        const totalStage1 = Number(form.stage1_amount) || 0;
        // 计算各行参考成本（历史均价 × 数量，新品回退到总均价）
        const totalQty = validLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
        const avgPrice = totalQty > 0 ? totalStage1 / totalQty : 0;
        const linesWithRef = validLines.map(l => {
          const pid = l.product_id === '__new__' ? null : Number(l.product_id);
          const prod = pid ? products.find(p => String(p.id) === String(pid)) : null;
          const poolRefUnit = prod?.avg_unit_cost || 0;
          const manualPrice = Number(l.manual_price) > 0 ? Number(l.manual_price) : 0;
          const refUnit = poolRefUnit || manualPrice || avgPrice || 0;
          const refCost = refUnit * (Number(l.quantity) || 0);
          return { ...l, pid, prod, refCost, refUnit, poolRefUnit, manualPrice };
        });
        const totalRefCost = linesWithRef.reduce((s, l) => s + l.refCost, 0);
        const ratio = totalRefCost > 0 ? totalStage1 / totalRefCost : 0;
        for (const line of linesWithRef) {
          const lineAmount = totalRefCost > 0
            ? Math.round(line.refCost * ratio * 100) / 100
            : totalQty > 0 ? Math.round(((Number(line.quantity) || 0) / totalQty) * totalStage1 * 100) / 100 : 0;
          // 池模式 + 新建商品 → 自动创建 product
          let pid = line.pid;
          if (!line.prod) {
            const created = await api.post('/products', {
              name: line.custom_name || body.name,
              name_zh: line.custom_name || body.name_zh || body.name || '',
              category: body.category,
              source: body.source,
            });
            pid = created.id;
          }
          await addToy({
            ...body,
            product_id: pid,
            quantity: Number(line.quantity),
            stage1_amount: lineAmount,
          });
        }
      } else {
        // 非池模式（原有逻辑）
        await addToy(body);
      }
      setShowForm(false);
      setPoolMode(false);
      setPoolLines([{ product_id: null, quantity: '' }]);
      setForm({ name: '', category: '其他', source: 'direct', status: 'procurement', procurement_stage: 'stage1', stage1_amount: '', stage2_amount: '', stage3_amount: '', stage1_date: new Date().toISOString().slice(0, 10), expected_arrival_date: '', product_id: null, quantity: '' });
    } catch (e) {
      setToast('添加失败');
    }
  };

  const isPreorderForm = form.status === 'preorder';

  const toggleSelect = useCallback((id) => {
    setSelectedIds(s => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  }, []);

  const selectAll = () => {
    setSelectedIds(new Set(filteredList.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    const ids = [...selectedIds];
    await deleteToys(ids);
    setSelectedIds(new Set());
    setBatchDeleteConfirm(false);
  };

  const stockinCandidates = [...selectedIds].filter(id => {
    const t = inProcurement.find(t => t.id === id);
    if (!t) return false;
    return t.procurement_stage === 'stage3' || (t.procurement_stage === 'stage2' && sourceGroup(t.source) === 'domestic');
  });

  const handleBatchStockin = async () => {
    await api.post('/toys/batch-stockin', { ids: stockinCandidates });
    useStore.getState().loadAll();
    setSelectedIds(new Set());
    setBatchStockinConfirm(false);
    setToast(`已入库 ${stockinCandidates.length} 件`);
  };

  const handleExitBulk = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="order-2 md:order-1">
          <h2 className="text-lg font-bold">采购</h2>
          <p className="text-xs text-[#6b7085]">{inProcurement.length} 件在途/预购中</p>
        </div>
        <div className="flex items-center gap-2 order-1 md:order-2 shrink-0">
          <button
            className={'text-xs ' + (batchMode ? 'btn-primary' : 'btn-ghost')}
            onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
          >
            {batchMode ? '退出批量' : '批量模式'}
          </button>
          <button
            className="btn-primary text-xs"
            onClick={() => setShowForm(!showForm)}
          >
            + 新增
          </button>
        </div>
      </div>

      {showForm && (
        <form className="card space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">商品名称 *</label>
              <input className="input text-xs" lang="zh-CN" spellCheck={false} autoComplete="off" placeholder="商品名" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">类型</label>
              <select className="input text-xs" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="procurement">采购中</option>
                <option value="preorder">预购（未上市/未到货）</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">品类</label>
              <select className="input text-xs" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">选择分类</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.parent_id ? '└ ' : ''}{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">采购方式</label>
              <div className="space-y-1.5">
                <select
                  className="input text-xs"
                  value={parseSource(form.source).cat}
                  onChange={e => {
                    const c = SOURCE_CATEGORIES.find(x => x.key === e.target.value);
                    if (c && c.type === 'simple') {
                      setForm({ ...form, source: c.key });
                    } else if (c) {
                      setForm({ ...form, source: toSourceValue(c.key, c.items[0].key) });
                    }
                  }}
                >
                  {SOURCE_CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                {(() => {
                  const cur = SOURCE_CATEGORIES.find(c => c.key === parseSource(form.source).cat);
                  if (cur?.type === 'group') {
                    const curDetail = parseSource(form.source).detail;
                    return (
                      <select
                        className="input text-xs"
                        value={curDetail || ''}
                        onChange={e => setForm({ ...form, source: toSourceValue(cur.key, e.target.value) })}
                      >
                        {cur.items.map(d => (
                          <option key={d.key} value={d.key}>{d.label}</option>
                        ))}
                      </select>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">
                {isPreorderForm ? '已付金额 (¥)' : (poolMode ? '①总买价 (¥) — 按均价配比分摊' : '①买价 (¥)')}
              </label>
              <input className="input text-xs" type="text" inputmode={isTouch ? "decimal" : undefined} lang="zh-CN" value={form.stage1_amount ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage1_amount: e.target.value === '' ? '' : +e.target.value })} />
            </div>
            {!poolMode && (
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">数量</label>
              <input className="input text-xs" type="text" inputmode="decimal" lang="zh-CN" placeholder="1"
                value={form.quantity || ''} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            )}
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">
                {isPreorderForm ? '上市/到货日' : '购入日期'}
              </label>
              <input className="input text-xs" type="date" value={form.stage1_date} onChange={e => setForm({ ...form, stage1_date: e.target.value })} />
            </div>
          </div>
          {/* 池模式开关 */}
          <div className="bg-black/20 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-orange-500"
                checked={poolMode}
                onChange={e => {
                  setPoolMode(e.target.checked);
                  if (!e.target.checked) {
                    setForm({ ...form, product_id: null, quantity: '' });
                    setPoolLines([{ product_id: null, quantity: '', custom_name: '', manual_price: '' }]);
                  }
                }} />
              <span className="text-xs text-[#d0d4e8]">批量入库（池模式）— 点下方「＋ 添加商品行」可拆分到多个池</span>
            </label>
            {poolMode && (() => {
              const totalStage1 = Number(form.stage1_amount) || 0;
              // 计算各行参考成本（新品回退到总均价）
              const linesWithQty = poolLines.map(l => ({
                ...l,
                qty: Number(l.quantity) || 0,
                prod: l.product_id && l.product_id !== '__new__' ? products.find(p => String(p.id) === String(l.product_id)) : null,
              }));
              const totalQty = linesWithQty.reduce((s, l) => s + l.qty, 0);
              const avgPrice = totalQty > 0 ? totalStage1 / totalQty : 0;
              const linesWithRef = linesWithQty.map(l => {
                const refUnit = l.prod?.avg_unit_cost || avgPrice || 0;
                const refCost = refUnit * l.qty;
                return { ...l, refUnit, refCost };
              });
              const totalRefCost = linesWithRef.reduce((s, l) => s + l.refCost, 0);
              const ratio = totalRefCost > 0 ? totalStage1 / totalRefCost : 0;

              const updateLine = (idx, field, value) => {
                const next = poolLines.map((l, i) => i === idx ? { ...l, [field]: value } : l);
                setPoolLines(next);
              };
              const addLine = () => setPoolLines([...poolLines, { product_id: null, quantity: '', custom_name: '', manual_price: '' }]);
              const removeLine = (idx) => {
                if (poolLines.length <= 1) return;
                setPoolLines(poolLines.filter((_, i) => i !== idx));
              };

              return (
                <div className="space-y-2">
                  {poolLines.map((line, idx) => {
                    const ref = linesWithRef[idx];
                    const allocated = totalRefCost > 0 && ref.refCost > 0
                      ? Math.round(ref.refCost * ratio * 100) / 100
                      : 0;
                    const isNew = line.product_id === '__new__';
                    const selectedProd = line.product_id && line.product_id !== '__new__'
                      ? products.find(p => p.id === Number(line.product_id)) : null;
                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        {selectedProd ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <div className="flex-1 input text-xs bg-white/5 truncate">{selectedProd.name_zh || selectedProd.name}</div>
                            <button type="button" className="text-[10px] text-[#6b7085] hover:text-white px-1 shrink-0"
                              onClick={() => updateLine(idx, 'product_id', null)}>✕</button>
                          </div>
                        ) : isNew ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input className="input text-xs flex-1" placeholder={form.name || '输入池号名称'}
                              value={line.custom_name || ''}
                              onChange={e => updateLine(idx, 'custom_name', e.target.value)}
                              lang="zh" spellCheck={false} autoComplete="off" />
                            <button type="button" className="text-[10px] text-[#6b7085] hover:text-white px-1 shrink-0"
                              onClick={() => updateLine(idx, 'product_id', null)}>✕</button>
                          </div>
                        ) : (
                          <select className="input text-xs flex-1 min-w-0" value={line.product_id || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '__new__') {
                                updateLine(idx, 'product_id', '__new__');
                              } else if (val) {
                                const pid = Number(val);
                                const prod = products.find(p => String(p.id) === String(pid));
                                updateLine(idx, 'product_id', pid);
                                if (idx === 0 && prod) {
                                  setForm(f => ({ ...f, name: prod.name || f.name, category: prod.category || f.category }));
                                }
                              } else {
                                updateLine(idx, 'product_id', null);
                              }
                            }}>
                            <option value="">— 选择 —</option>
                            <option value="__new__">+ 新建池号</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name_zh || p.name}</option>
                            ))}
                          </select>
                        )}
                        <input className="input text-xs w-14 text-center" type="text" inputmode="decimal" placeholder="数量"
                          value={line.quantity || ''}
                          onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                        <span className="text-[10px] text-[#6b7085] shrink-0 leading-tight text-right">
                          {ref.poolRefUnit > 0 ? (
                            <>参考 ¥{ref.refUnit.toFixed(0)}<br/>= ¥{ref.refCost.toFixed(0)}</>
                          ) : line.product_id ? (
                            <span className="inline-flex items-center gap-0.5">
                              <span className="text-[#4b5065]">¥</span>
                              <input className="input text-[10px] w-12 text-center px-1 py-0" type="text" inputmode="decimal" placeholder="估价"
                                value={line.manual_price || ''}
                                onChange={e => updateLine(idx, 'manual_price', e.target.value)} />
                              {ref.manualPrice > 0 && (
                                <span className="text-[#9ba0b5]">= ¥{ref.refCost.toFixed(0)}</span>
                              )}
                            </span>
                          ) : null}
                        </span>
                        {poolLines.length > 1 && (
                          <button type="button" className="text-[#6b7085] hover:text-red-400 text-xs px-1 shrink-0"
                            onClick={() => removeLine(idx)}>✕</button>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" className="text-[11px] text-accent font-medium hover:text-white border border-accent/40 rounded-lg px-3 py-1.5 w-full bg-accent/5 hover:bg-accent/10"
                    onClick={addLine}>＋ 添加商品行</button>
                  {/* 汇总 */}
                  {totalQty > 0 && (
                    <div className="text-[10px] text-[#6b7085] space-y-0.5 pt-1 border-t border-white/5">
                      <div className="flex justify-between">
                        <span>总数量 {totalQty} 件 · 参考总成本</span>
                        <span>¥{totalRefCost.toFixed(0)}</span>
                      </div>
                      {totalStage1 > 0 && totalRefCost > 0 && (
                        <div className="flex justify-between text-accent">
                          <span>分摊预览（比例 {(ratio * 100).toFixed(0)}%）</span>
                          <span>
                            {linesWithRef.filter(l => l.refCost > 0).map(l => {
                              const a = Math.round(l.refCost * ratio * 100) / 100;
                              return `${l.prod?.name_zh || l.prod?.name || l.custom_name || '?'} ¥${a.toFixed(0)}`;
                            }).join(' · ')}
                          </span>
                        </div>
                      )}
                      {totalStage1 > 0 && totalRefCost === 0 && (
                        <div className="text-yellow-400">所有商品无历史均价，将按数量均摊</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {isPreorderForm && (
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">
                预计到货日 <span className="text-[#6b7085]">(可选)</span>
              </label>
              <input className="input text-xs" type="date" value={form.expected_arrival_date || ''} onChange={e => setForm({ ...form, expected_arrival_date: e.target.value })} />
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">添加</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </form>
      )}

      {/* Tabs: 全部 / 预购 / 阶段①②③ */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const count = t.key === 'all' ? inProcurement.length
            : t.key === 'preorder' ? inProcurement.filter(x => x.status === 'preorder').length
              : inProcurement.filter(x => x.procurement_stage === t.key).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`card flex-1 min-w-[90px] text-center transition-all ${
                active ? 'ring-1' : 'opacity-60 hover:opacity-100'
              }`}
              style={{
                borderColor: count > 0 ? t.color + '60' : undefined,
                ...(active && { boxShadow: `0 0 0 1px ${t.color}60` }),
              }}
            >
              <div className="text-lg font-bold" style={{ color: t.color }}>{count}</div>
              <div className="text-[10px] text-[#6b7085]">{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* 批量操作栏 */}
      {batchMode && (
        <div className="bg-bg rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b7085]">已选{selectedIds.size}项</span>
            <button className="btn-ghost text-xs py-1 px-2" onClick={selectAll}>全选</button>
          </div>
          <div className="flex items-center gap-2">
            {stockinCandidates.length > 0 && (
              <button
                className="btn-primary text-xs bg-green-600 py-1.5 px-3"
                onClick={() => setBatchStockinConfirm(true)}
              >
                入库 {stockinCandidates.length} 项
              </button>
            )}
            <button
              className="btn-primary text-xs bg-red-600 py-1.5 px-3"
              disabled={selectedIds.size === 0}
              onClick={() => setBatchDeleteConfirm(true)}
            >
              删除 {selectedIds.size} 项
            </button>
          </div>
        </div>
      )}

      {batchDeleteConfirm && (
        <ConfirmModal
          message={"确定删除已选的 " + selectedIds.size + " 件商品？此操作不可撤销。"}
          onConfirm={handleBatchDelete}
          onCancel={() => setBatchDeleteConfirm(false)}
        />
      )}

      {batchStockinConfirm && (
        <ConfirmModal
          title="批量入库"
          message={"确定将 " + stockinCandidates.length + " 件商品入库？"}
          onConfirm={handleBatchStockin}
          onCancel={() => setBatchStockinConfirm(false)}
        />
      )}

      {filteredList.length === 0 && (
        <div className="text-center py-16 text-[#6b7085] text-sm">
          {tab === 'preorder' ? '暂无预购' : '暂无采购记录'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredList.map(toy => (
          <ToyRow
            key={toy.id}
            toy={toy}
            onUpdate={updateToy}
            onDelete={deleteToy}
            categories={categories}
            allToys={inProcurement}
            batchMode={batchMode}
            selected={selectedIds.has(toy.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>
    </div>
  );
}
