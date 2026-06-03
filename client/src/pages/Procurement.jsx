import { useState, useEffect } from 'react';
import useStore from '../stores/useStore';
import { api } from '../lib/api';
import ConfirmModal from '../components/ConfirmModal';

const STAGES = ['stage1', 'stage2', 'stage3'];
const STAGE_NAMES = { stage1: '买货中', stage2: '国内转运', stage3: '国际运输' };
const STAGE_LABELS = { stage1: '①', stage2: '②', stage3: '③' };
const STAGE_COLORS = { stage1: '#f0a030', stage2: '#60a5fa', stage3: '#a78bfa' };

function StageChip({ stage }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: STAGE_COLORS[stage] + '22', color: STAGE_COLORS[stage] }}>
      {STAGE_LABELS[stage]} {STAGE_NAMES[stage]}
    </span>
  );
}

/* 阶段推进弹窗 */
function StageAdvanceModal({ toy, allToys, onConfirm, onCancel }) {
  const current = toy.procurement_stage; // 'stage1' | 'stage2'
  const next = current === 'stage1' ? 'stage2' : 'stage3';
  const isS2 = next === 'stage2'; // 推进到阶段2
  const isS3 = next === 'stage3'; // 推进到阶段3

  const [stage2_handling, setStage2_handling] = useState(toy.stage2_handling ?? '');
  const [stage2_domestic_ship, setStage2_domestic_ship] = useState(toy.stage2_domestic_ship ?? '');
  const [stage3_intl_ship, setStage3_intl_ship] = useState(toy.stage3_intl_ship ?? '');
  const [weight, setWeight] = useState(toy.logistics_weight ?? '');
  const [total_ship_fee, setTotal_ship_fee] = useState(''); // 整批总国际运费

  // 找出同在阶段②的直购商品（可拼邮）
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

  const tax = Math.round((toy.stage1_amount || 0) * 0.13 * 100) / 100;

  // 阶段②小计 = 手续费 + 国内物流
  const stage2Total = (stage2_handling || 0) + (stage2_domestic_ship || 0);

  // 分摊计算
  const allSelected = [toy, ...(allToys || []).filter(t => selectedIds.has(t.id))];
  const totalWeight = allSelected.reduce((s, t) => s + (t.logistics_weight || 0), 0);
  const shipFee = parseFloat(total_ship_fee) || 0;

  function calcShare(t) {
    if (!isS3 || totalWeight <= 0 || shipFee <= 0) return 0;
    return Math.round((t.logistics_weight || 0) / totalWeight * shipFee * 100) / 100;
  }

  const currentShare = calcShare(toy);
  const currentTax = Math.round((toy.stage1_amount || 0) * 0.13 * 100) / 100;
  const currentS3Total = currentShare + currentTax;

  const handleConfirm = async () => {
    if (isS2) {
      // 推进到阶段②：先更新当前商品的重量
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
      // 推进到阶段③：分摊运费
      const batch = allSelected.map(t => {
        const share = calcShare(t);
        const tTax = Math.round((t.stage1_amount || 0) * 0.13 * 100) / 100;
        return {
          ...t,
          procurement_stage: 'stage3',
          stage3_intl_ship: share,
          stage3_tax: tTax,
          stage3_amount: share + tTax,
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
          <span className="text-xs text-[#6b7085]">— {toy.name}</span>
        </div>

        {/* ── 阶段② ── */}
        {isS2 && toy.source !== 'domestic' && (
          <>
            <p className="text-xs text-[#6b7085]">填写日本境内产生的费用：</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">重量 (kg)</label>
                <input className="input text-xs" type="number" min="0" step="0.1" value={weight ?? ''} placeholder="0" onChange={e => setWeight(e.target.value === '' ? '' : +e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">手续费 (¥)</label>
                <input className="input text-xs" type="number" min="0" value={stage2_handling ?? ''} placeholder="0" onChange={e => setStage2_handling(e.target.value === '' ? '' : +e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">国内物流费 (¥)</label>
                <input className="input text-xs" type="number" min="0" value={stage2_domestic_ship ?? ''} placeholder="0" onChange={e => setStage2_domestic_ship(e.target.value === '' ? '' : +e.target.value)} />
              </div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center">
              <span className="text-[10px] text-[#6b7085]">阶段②小计：</span>
              <span className="ml-2 text-sm font-bold text-[#d0d4e8]">¥{stage2Total.toFixed(2)}</span>
            </div>
          </>
        )}
        {isS2 && toy.source === 'domestic' && (
          <>
            <p className="text-xs text-[#6b7085]">填写国内运费：</p>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">国内运费 (¥)</label>
              <input className="input text-xs" type="number" min="0" value={stage2_domestic_ship ?? ''} placeholder="0" onChange={e => setStage2_domestic_ship(e.target.value === '' ? '' : +e.target.value)} />
            </div>
            <div className="bg-black/30 rounded-lg p-3 text-center mt-3">
              <span className="text-[10px] text-[#6b7085]">阶段②小计：</span>
              <span className="ml-2 text-sm font-bold text-[#d0d4e8]">¥{(stage2_domestic_ship || 0).toFixed(2)}</span>
            </div>
          </>
        )}

        {/* ── 阶段③（直购专用）── */}
        {isS3 && (
          <>
            {/* 拼邮勾选列表 */}
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
                      <span className="flex-1 truncate text-[#d0d4e8]">{t.name}</span>
                      {t.logistics_weight > 0
                        ? <span className="text-[#6b7085]">{t.logistics_weight}kg</span>
                        : <span className="text-red-400 text-[9px]">未填重量</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 总运费输入 */}
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">
                整批总国际运费 (¥){selectedIds.size > 0 && <span className="text-orange-400">（含 {selectedIds.size + 1} 件）</span>}
              </label>
              <input className="input text-xs" type="number" min="0" value={total_ship_fee} placeholder="0"
                onChange={e => setTotal_ship_fee(e.target.value)} />
            </div>

            {/* 当前商品分摊预览 */}
            <div className="bg-black/30 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-[#6b7085]">分摊重量</span><span className="text-[#d0d4e8]">{toy.logistics_weight || 0}kg / {totalWeight}kg</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#6b7085]">国际运费分摊</span><span className="text-[#d0d4e8]">¥{currentShare.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#6b7085]">税费（买价×13%）</span><span className="text-[#d0d4e8]">¥{currentTax.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs border-t border-white/5 pt-1 font-bold"><span className="text-[#6b7085]">阶段③小计</span><span className="text-accent">¥{currentS3Total.toFixed(2)}</span></div>
            </div>

            {/* 其他选中商品预览 */}
            {selectedIds.size > 0 && totalWeight > 0 && shipFee > 0 && (
              <div className="bg-black/20 rounded-lg p-2 space-y-0.5">
                <p className="text-[10px] text-[#6b7085] mb-1">其他商品分摊：</p>
                {[...selectedIds].map(id => {
                  const t = (allToys || []).find(x => x.id === id);
                  if (!t) return null;
                  const share = calcShare(t);
                  const tTax = Math.round((t.stage1_amount || 0) * 0.13 * 100) / 100;
                  return (
                    <div key={id} className="flex justify-between text-[10px]">
                      <span className="text-[#6b7085] truncate flex-1">{t.name}</span>
                      <span className="text-[#d0d4e8] ml-2">¥{share.toFixed(2)} + ¥{tTax.toFixed(2)}税</span>
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

function ToyRow({ toy, onUpdate, onDelete, categories, allToys }) {
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [advancingTo, setAdvancingTo] = useState(null); // null | 'stage2' | 'stage3'
  const [form, setForm] = useState(toy);

  const totalCost = toy.total_cost || 0;

  const handleSave = async () => {
    const updates = { ...form };
    // 汇总阶段2金额
    if (toy.procurement_stage === 'stage2' || toy.procurement_stage === 'stage3') {
      updates.stage2_amount = (updates.stage2_handling || 0) + (updates.stage2_domestic_ship || 0);
    }
    // 汇总阶段3金额（含税费）
    if (toy.procurement_stage === 'stage3') {
      updates.stage3_tax = Math.round((updates.stage1_amount || 0) * 0.13 * 100) / 100;
      updates.stage3_amount = (updates.stage3_intl_ship || 0) + updates.stage3_tax;
    }
    await onUpdate(toy.id, updates);
    setEditing(false);
  };

  const handleAdvanceConfirm = async (id, updates) => {
    await onUpdate(id, updates);
    setAdvancingTo(null);
  };

  const stage2SubLabel = (toy.stage2_handling > 0 || toy.stage2_domestic_ship > 0)
    ? `手续费¥${toy.stage2_handling} + 物流¥${toy.stage2_domestic_ship}`
    : null;
  const stage3SubLabel = (toy.stage3_intl_ship > 0 || toy.stage3_tax > 0)
    ? `运费¥${toy.stage3_intl_ship} + 税¥${toy.stage3_tax}`
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

      <div className="card mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold truncate">{toy.name}</span>
              <StageChip stage={toy.procurement_stage} />
            </div>
            <div className="text-[10px] text-[#6b7085]">
              {toy.purchase_date || toy.created_at?.slice(0, 10)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-accent">¥{totalCost.toFixed(0)}</div>
            <div className="text-[9px] text-[#6b7085]">总成本</div>
          </div>
        </div>

        {/* Stage breakdown */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {/* ① */}
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <div className="text-[9px] text-[#6b7085] mb-1">① 买货</div>
            <div className="text-sm font-bold text-[#d0d4e8]">¥{toy.stage1_amount || 0}</div>
            {toy.source && <div className="text-[9px] text-[#6b7085] mt-0.5">{toy.source === 'direct' ? '直购' : toy.source === 'proxy' ? '代购' : '国内'}</div>}
          </div>
          {/* ② */}
          <div className={`rounded-lg p-2 text-center ${toy.stage2_amount > 0 ? 'bg-black/20' : 'bg-black/10 border border-dashed border-white/10'}`}>
            <div className="text-[9px] text-[#6b7085] mb-1">② 国内转运</div>
            <div className="text-sm font-bold text-[#d0d4e8]">¥{toy.stage2_amount || 0}</div>
            {stage2SubLabel && <div className="text-[8px] text-[#6b7085] mt-0.5 truncate">{stage2SubLabel}</div>}
          </div>
          {/* ③ */}
          <div className={`rounded-lg p-2 text-center ${toy.stage3_amount > 0 ? 'bg-black/20' : 'bg-black/10 border border-dashed border-white/10'}`}>
            <div className="text-[9px] text-[#6b7085] mb-1">③ 国际运输</div>
            <div className="text-sm font-bold text-[#d0d4e8]">¥{toy.stage3_amount || 0}</div>
            {stage3SubLabel && <div className="text-[8px] text-[#6b7085] mt-0.5 truncate">{stage3SubLabel}</div>}
            {toy.stage3_tax > 0 && <div className="text-[8px] text-[#6b7085]">税¥{toy.stage3_tax}</div>}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {toy.procurement_stage === 'stage1' && (
            <button className="btn-primary flex-1 text-xs" onClick={() => setAdvancingTo('stage2')}>
              推进到②国内转运
            </button>
          )}
          {toy.procurement_stage === 'stage2' && toy.source !== 'domestic' && (
            <button className="btn-primary flex-1 text-xs" onClick={() => setAdvancingTo('stage3')}>
              推进到③国际运输
            </button>
          )}
          {toy.procurement_stage === 'stage3' && (
            <button
              className="btn-primary flex-1 text-xs bg-green-600"
              onClick={() => onUpdate(toy.id, { ...toy, status: 'stock', procurement_stage: 'stocked' })}
            >
              ✓ 确认入库
            </button>
          )}
          {toy.procurement_stage === 'stage2' && toy.source === 'domestic' && (
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

        {/* Edit form */}
        {editing && (
          <div className="mt-4 border-t border-white/5 pt-4">
            {/* 阶段列 */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {/* 阶段1 */}
              <div className="bg-black/20 rounded-lg p-3 border border-[#f0a030]/20">
                <div className="text-[10px] font-bold text-[#f0a030] mb-2">① 买货</div>
                <div>
                  <label className="text-[10px] text-[#6b7085] block mb-1">买价 (¥)</label>
                  <input className="input text-xs" type="number" value={form.stage1_amount ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage1_amount: e.target.value === '' ? '' : +e.target.value })} />
                </div>
              </div>
              {/* 阶段2 */}
              <div className="bg-black/20 rounded-lg p-3 border border-[#60a5fa]/20">
                <div className="text-[10px] font-bold text-[#60a5fa] mb-2">② 国内转运</div>
                <div className="space-y-2">
                  {toy.source === 'direct' && (
                    <div>
                      <label className="text-[10px] text-[#6b7085] block mb-1">重量 (kg)</label>
                      <input className="input text-xs" type="number" min="0" step="0.1" value={form.logistics_weight ?? ''} placeholder="0" onChange={e => setForm({ ...form, logistics_weight: e.target.value === '' ? '' : +e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-[#6b7085] block mb-1">手续费 (¥)</label>
                    <input className="input text-xs" type="number" value={form.stage2_handling ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage2_handling: e.target.value === '' ? '' : +e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7085] block mb-1">国内物流费 (¥)</label>
                    <input className="input text-xs" type="number" value={form.stage2_domestic_ship ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage2_domestic_ship: e.target.value === '' ? '' : +e.target.value })} />
                  </div>
                </div>
              </div>
              {/* 阶段3 */}
              <div className="bg-black/20 rounded-lg p-3 border border-[#a78bfa]/20">
                <div className="text-[10px] font-bold text-[#a78bfa] mb-2">③ 国际运输</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-[#6b7085] block mb-1">国际运费 (¥)</label>
                    <input className="input text-xs" type="number" value={form.stage3_intl_ship ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage3_intl_ship: e.target.value === '' ? '' : +e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7085] block mb-1">税费 (¥，13%)</label>
                    <input className="input text-xs bg-black/20 cursor-default" type="number" value={((form.stage1_amount || 0) * 0.13).toFixed(2)} readOnly />
                  </div>
                </div>
              </div>
            </div>
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">商品名称</label>
                <input className="input text-xs" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-[#6b7085] block mb-1">品类</label>
                <select className="input text-xs" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">选择分类</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {/* 备注 + 保存 */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-[#6b7085] block mb-1">备注</label>
                <input className="input text-xs" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <button className="btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
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
}

export default function Procurement() {
  const { toys, suppliers, addToy, updateToy, deleteToy, setToast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: '', category: '其他', source: 'direct', procurement_stage: 'stage1',
    stage1_amount: '', stage2_amount: '', stage3_amount: '',
    stage1_date: new Date().toISOString().slice(0, 10),
  });

  const inProcurement = toys.filter(t =>
    ['procurement', 'transit'].includes(t.status) ||
    (t.procurement_stage && !['stocked'].includes(t.procurement_stage))
  );

  useEffect(() => {
    api.get('/settings/categories').then(cats => setCategories(cats)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return setToast('请填写名称');
    try {
      await addToy(form);
      setShowForm(false);
      setForm({ name: '', category: '其他', source: 'direct', procurement_stage: 'stage1', stage1_amount: '', stage2_amount: '', stage3_amount: '', stage1_date: new Date().toISOString().slice(0, 10) });
    } catch (e) {
      setToast('添加失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">采购</h2>
          <p className="text-xs text-[#6b7085]">{inProcurement.length} 件在采购中</p>
        </div>
        <button className="btn-primary text-xs" onClick={() => setShowForm(!showForm)}>
          + 新增
        </button>
      </div>

      {showForm && (
        <form className="card space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">商品名称 *</label>
              <input className="input text-xs" placeholder="商品名" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">品类</label>
              <select className="input text-xs" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">选择分类</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">采购方式</label>
              <select className="input text-xs" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                <option value="direct">直购</option>
                <option value="proxy">代购</option>
                <option value="domestic">国内</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">①买价 (¥)</label>
              <input className="input text-xs" type="number" value={form.stage1_amount ?? ''} placeholder="0" onChange={e => setForm({ ...form, stage1_amount: e.target.value === '' ? '' : +e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">日期</label>
              <input className="input text-xs" type="date" value={form.stage1_date} onChange={e => setForm({ ...form, stage1_date: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">添加</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </form>
      )}

      {/* Stage tabs */}
      <div className="flex gap-2 flex-wrap">
        {STAGES.map(s => {
          const count = inProcurement.filter(t => t.procurement_stage === s).length;
          return (
            <div key={s} className="card flex-1 min-w-[100px] text-center" style={{ borderColor: count > 0 ? STAGE_COLORS[s] + '40' : undefined }}>
              <div className="text-lg font-bold" style={{ color: STAGE_COLORS[s] }}>{count}</div>
              <div className="text-[10px] text-[#6b7085]">{STAGE_NAMES[s]}</div>
            </div>
          );
        })}
      </div>

      {inProcurement.length === 0 && (
        <div className="text-center py-16 text-[#6b7085] text-sm">暂无采购记录</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {inProcurement.map(toy => (
          <ToyRow
            key={toy.id}
            toy={toy}
            onUpdate={updateToy}
            onDelete={deleteToy}
            categories={categories}
            allToys={inProcurement}
          />
        ))}
      </div>
    </div>
  );
}
