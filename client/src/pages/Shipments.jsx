import { useState } from 'react';
import useStore from '../stores/useStore';

const STATUS_MAP = {
  preparing: { label: '准备中', color: '#f0a030' },
  in_transit: { label: '运输中', color: '#60a5fa' },
  arrived: { label: '已到达', color: '#34d399' },
};

export default function Shipments() {
  const { shipments, toys, addShipment, updateShipment } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', total_weight: '', total_intl_shipping: '', notes: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    await addShipment(form);
    setShowForm(false);
    setForm({ name: '', total_weight: '', total_intl_shipping: '', notes: '' });
  };

  // 未分配批次的采购中商品
  const unassigned = toys.filter(t =>
    (t.status === 'procurement' || t.status === 'transit') && !t.shipment_id
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">发货批次</h2>
          <p className="text-xs text-[#6b7085]">{shipments.length} 个批次</p>
        </div>
        <button className="btn-primary text-xs" onClick={() => setShowForm(!showForm)}>+ 新批次</button>
      </div>

      {showForm && (
        <form className="card space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">批次名称 *</label>
            <input className="input text-xs" placeholder="如 2026-05 批次" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">总重量 (kg)</label>
              <input className="input text-xs" type="text" inputmode="decimal" step="0.1" value={form.total_weight} onChange={e => setForm({ ...form, total_weight: +e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">国际运费 (¥)</label>
              <input className="input text-xs" type="text" inputmode="decimal" value={form.total_intl_shipping} onChange={e => setForm({ ...form, total_intl_shipping: +e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">创建</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </form>
      )}

      {/* Unassigned items */}
      {unassigned.length > 0 && (
        <div className="card">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-3">未分配批次 ({unassigned.length})</div>
          <div className="space-y-2">
            {unassigned.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div>
                  <div className="text-sm">{t.name}</div>
                  <div className="text-[10px] text-[#6b7085]">{t.supplier_name || t.source}</div>
                </div>
                <span className="badge badge-orange">待分配</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {shipments.length === 0 && unassigned.length === 0 && (
        <div className="text-center py-16 text-[#6b7085] text-sm">暂无发货批次</div>
      )}

      {shipments.map(sh => {
        const status = STATUS_MAP[sh.status] || STATUS_MAP.preparing;
        return (
          <div key={sh.id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-bold">{sh.name}</div>
                <div className="text-[10px] text-[#6b7085]">{sh.created_at?.slice(0, 10)} · {sh.toy_count || 0} 件</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="bg-transparent border border-white/10 rounded px-2 py-1 text-xs"
                  value={sh.status}
                  onChange={e => updateShipment(sh.id, { ...sh, status: e.target.value, arrived_date: e.target.value === 'arrived' ? new Date().toISOString().slice(0, 10) : null })}
                >
                  <option value="preparing">准备中</option>
                  <option value="in_transit">运输中</option>
                  <option value="arrived">已到达</option>
                </select>
              </div>
            </div>

            {sh.toys?.length > 0 ? (
              <div className="space-y-2 mt-3 border-t border-white/5 pt-3">
                {sh.toys.map(t => (
                  <div key={t.id} className="flex justify-between items-center text-xs">
                    <span className="text-[#a0a4b8]">{t.name}</span>
                    <span className="text-accent font-bold">¥{t.total_cost?.toFixed(0)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                  <span className="text-[#6b7085]">运费分摊</span>
                  <span>¥{((sh.total_intl_shipping || 0) / sh.toys.length).toFixed(0)}/件</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#6b7085] text-center py-4">暂无关联商品</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
