import { useState, useEffect } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import useStore from '../stores/useStore';
import { api } from '../lib/api';

const FILTERS = [
  { key: 'stock', label: '在库' },
  { key: 'sold', label: '已发货' },
  { key: 'done', label: '已完成' },
];

const SOURCE_LABELS = { direct: '直购', proxy: '代购', domestic: '国内', secondhand: '二手' };

function ToyCard({ toy, onSell, onEdit, onDelete, onReturn, onDone }) {
  const [expanded, setExpanded] = useState(false);

  const statusBadge = {
    stock: { label: '在库', bg: 'rgba(74,222,128,0.15)', color: '#34d399' },
    sold: { label: '已发货', bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' },
    done: { label: '已完成', bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
    returned: { label: '已退货', bg: 'rgba(248,113,113,0.15)', color: '#f87171' },
  }[toy.status] || { label: toy.status, bg: 'rgba(255,255,255,0.05)', color: '#6b7085' };

  return (
    <div className="card cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate mb-1">{toy.name}</div>
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
        <span>{SOURCE_LABELS[toy.source] || toy.source}</span>
        <span>·</span>
        <span>{toy.category}</span>
        <span>·</span>
        <span>{toy.purchase_date || toy.created_at?.slice(0, 10)}</span>
      </div>

      {expanded && (
        <div className="border-t border-white/5 pt-3 mt-3 space-y-1 text-xs">
          {toy.source === 'direct' && (
            <>
              {toy.japan_price_cny > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">本体价</span><span>¥{toy.japan_price_cny}</span></div>}
              {toy.handling_fee > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">手续费</span><span>¥{toy.handling_fee}</span></div>}
              {toy.japan_domestic_shipping > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">日本运费</span><span>¥{toy.japan_domestic_shipping}</span></div>}
              {toy.intl_shipping > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">国际运费</span><span>¥{toy.intl_shipping}</span></div>}
              {toy.tax > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">税费</span><span>¥{toy.tax}</span></div>}
            </>
          )}
          {toy.source === 'proxy' && (
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
          {toy.sell_price > 0 && <div className="flex justify-between text-green-400"><span className="text-[#6b7085]">售价</span><span>¥{toy.sell_price}</span></div>}
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
          <button className="btn-danger" onClick={e => { e.stopPropagation(); onDelete(toy.id); }}>删除</button>
          {toy.status === 'sold' && (
            <>
              <button className="btn-warn flex-1" onClick={e => { e.stopPropagation(); onReturn(toy); }}>退换</button>
              <button className="btn-success flex-1" onClick={e => { e.stopPropagation(); onDone(toy.id); }}>确认完成</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 售出弹窗 ─── */
function SellModal({ toy, onConfirm, onCancel }) {
  const { shippingRules, supplies } = useStore();
  const boxSupplies = supplies.filter(s => s.category === 'box');

  const [form, setForm] = useState({
    sell_price: toy.sell_price || '',
    include_worry_free: toy.worry_free_service_fee > 0 ? true : toy.worry_free_service_fee === 0 && toy.sell_price > 0 ? false : true,
    include_huabei: toy.huabei > 0 ? true : toy.huabei === 0 && toy.sell_price > 0 ? false : true,
    dispute_fee: '',
    bao_you: toy.logistics_fee > 0 || toy.box_fee > 0 || toy.packing_fee > 0 ? true : false,
    carrier: toy.logistics_fee > 0 ? 'zto' : '',
    logistics_region: toy.logistics_region || '',
    logistics_weight: toy.logistics_weight || '',
    selected_boxes: [],
  });

  const [calcLogisticsFee, setCalcLogisticsFee] = useState(toy.logistics_fee || 0);
  const [calcBoxFee, setCalcBoxFee] = useState(toy.box_fee || 0);
  const [packingFee, setPackingFee] = useState(toy.packing_fee || 0);

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
  const softwareFee = price * 0.01;
  const basicFee = price * 0.006;
  const worryFreeFee = form.include_worry_free ? price * 0.025 : 0;
  const huabeiFee = form.include_huabei ? price * 0.03 : 0;
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
        <h3 className="text-base font-bold">出售 {toy.name}</h3>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {/* 售出价格 */}
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">售出价格 (¥)</label>
            <input className="input" type="number" placeholder="输入售价" value={form.sell_price}
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
                            {shippingRules.map(r => (
                              <option key={r.id} value={r.provinces}>{r.provinces}（{r.region_name}）</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#6b7085] block mb-1">重量 (kg)</label>
                          <input className="input text-xs" type="number" min="0" step="0.1" placeholder="0"
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
                    <input className="input text-xs" type="number" min="0" placeholder="0"
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

          {/* 手续费明细 */}
          <div className="bg-black/30 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#6b7085]">
              <span>软件服务费（1%）</span>
              <span>¥{softwareFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#6b7085]">
              <span>基础软件服务费（0.6%）</span>
              <span>¥{basicFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/5 my-1.5" />
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-1.5 cursor-pointer flex-1">
                <input type="checkbox" className="accent-orange-500"
                  checked={form.include_worry_free}
                  onChange={e => setForm({ ...form, include_worry_free: e.target.checked })} />
                <span>无忧卖服务费（2.5%）</span>
              </label>
              <span className={form.include_worry_free ? 'text-[#d0d4e8]' : 'text-[#6b7085]'}>¥{worryFreeFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-1.5 cursor-pointer flex-1">
                <input type="checkbox" className="accent-orange-500"
                  checked={form.include_huabei}
                  onChange={e => setForm({ ...form, include_huabei: e.target.checked })} />
                <span>花呗扣款（3%）</span>
              </label>
              <span className={form.include_huabei ? 'text-[#d0d4e8]' : 'text-[#6b7085]'}>¥{huabeiFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/5 pt-1.5 flex justify-between font-bold text-[#d0d4e8]">
              <span>手续费合计</span>
              <span>¥{totalFees.toFixed(2)}</span>
            </div>
          </div>

          {/* 纠纷退款（可选） */}
          {(toy.status === 'sold' || toy.status === 'done') && (
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">纠纷退款 (¥)（可选）</label>
              <input className="input" type="number" placeholder="如有纠纷退款，填写金额"
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
        status: 'sold',
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
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
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
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">售出价格 * (¥)</label>
              <input className="input" type="number" placeholder="0" value={form.sell_price}
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
    stage3_intl_ship: toy.stage3_intl_ship ?? '',
    stage3_tax: toy.stage3_tax ?? ((toy.stage3_amount || 0) - (toy.stage3_intl_ship || 0)) || '',
    sell_price: toy.sell_price ?? '',
    sell_date: toy.sell_date || '',
    return_cost: toy.return_cost ?? '',
    logistics_fee: toy.logistics_fee ?? '',
    box_fee: toy.box_fee ?? '',
    packing_fee: toy.packing_fee ?? '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const updates = { name: form.name.trim(), category: form.category, notes: form.notes };
    if (form.stage1_amount !== '') updates.stage1_amount = +form.stage1_amount;
    if (form.stage2_amount !== '') updates.stage2_amount = +form.stage2_amount;
    if (form.stage3_intl_ship !== '' || form.stage3_tax !== '') {
      const ship = form.stage3_intl_ship === '' ? 0 : +form.stage3_intl_ship;
      const tax = form.stage3_tax === '' ? 0 : +form.stage3_tax;
      updates.stage3_intl_ship = ship;
      updates.stage3_tax = tax;
      updates.stage3_amount = ship + tax;
    }
    // 售价编辑：仅 sold/done 状态可修改
    if ((toy.status === 'sold' || toy.status === 'done') && form.sell_price !== '') {
      updates.sell_price = +form.sell_price;
      updates.sell_date = form.sell_date || toy.sell_date || new Date().toISOString().slice(0, 10);
    }
    if (form.return_cost !== '') updates.return_cost = +form.return_cost;
    if (form.logistics_fee !== '') updates.logistics_fee = +form.logistics_fee;
    if (form.box_fee !== '') updates.box_fee = +form.box_fee;
    if (form.packing_fee !== '') updates.packing_fee = +form.packing_fee;
    onConfirm(toy.id, updates);
  };

  const totalCost = (toy.total_cost || 0) + (toy.return_cost || 0);
  const profit = toy.sell_price
    ? toy.sell_price - totalCost
      - (toy.software_service_fee || 0)
      - (toy.basic_software_service_fee || 0)
      - (toy.worry_free_service_fee || 0)
      - (toy.huabei || 0)
      - (toy.logistics_fee || 0)
      - (toy.box_fee || 0)
      - (toy.packing_fee || 0)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold">编辑 {toy.name}</h3>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">商品名称</label>
            <input className="input text-xs" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">品类</label>
            <select className="input text-xs" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">选择分类</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {/* 阶段成本（可编辑） */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">①买价</label>
              <input className="input text-xs" type="number" placeholder="0" value={form.stage1_amount} onChange={e => setForm({ ...form, stage1_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">②转运</label>
              <input className="input text-xs" type="number" placeholder="0" value={form.stage2_amount} onChange={e => setForm({ ...form, stage2_amount: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">③国际运费</label>
              <input className="input text-xs" type="number" placeholder="0" value={form.stage3_intl_ship} onChange={e => setForm({ ...form, stage3_intl_ship: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-[#6b7085] block mb-1">③税费</label>
              <input className="input text-xs" type="number" placeholder="0" value={form.stage3_tax} onChange={e => setForm({ ...form, stage3_tax: e.target.value })} />
            </div>
          </div>

          {/* 已完成/已发货：展示完整费用明细 */}
          {(toy.status === 'sold' || toy.status === 'done') && (
            <>
              {/* 购入成本明细（只读） */}
              <div className="bg-black/20 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="text-[10px] text-[#6b7085] font-bold mb-1">购入成本明细</div>
                <div className="flex justify-between"><span className="text-[#6b7085]">①买价</span><span className="text-[#d0d4e8]">¥{toy.stage1_amount || 0}</span></div>
                {(toy.stage2_handling > 0 || toy.stage2_domestic_ship > 0) && (
                  <>
                    <div className="flex justify-between pl-2"><span className="text-[#6b7085]">手续费</span><span className="text-[#d0d4e8]">¥{toy.stage2_handling || 0}</span></div>
                    <div className="flex justify-between pl-2"><span className="text-[#6b7085]">国内物流费</span><span className="text-[#d0d4e8]">¥{toy.stage2_domestic_ship || 0}</span></div>
                  </>
                )}
                {(toy.stage3_intl_ship > 0 || toy.stage3_tax > 0) && (
                  <>
                    <div className="flex justify-between pl-2"><span className="text-[#6b7085]">国际运费</span><span className="text-[#d0d4e8]">¥{toy.stage3_intl_ship || 0}</span></div>
                    <div className="flex justify-between pl-2"><span className="text-[#6b7085]">税费</span><span className="text-[#d0d4e8]">¥{toy.stage3_tax || 0}</span></div>
                  </>
                )}
                <div className="border-t border-white/5 pt-1.5 flex justify-between font-bold"><span className="text-[#6b7085]">成本合计</span><span className="text-[#d0d4e8]">¥{totalCost.toFixed(2)}</span></div>
                {toy.return_cost > 0 && <div className="flex justify-between"><span className="text-[#6b7085]">退换货成本</span><span className="text-[#d0d4e8]">¥{toy.return_cost}</span></div>}
              </div>

              {/* 平台扣费明细（只读） */}
              <div className="bg-black/20 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="text-[10px] text-[#6b7085] font-bold mb-1">平台扣费明细</div>
                <div className="flex justify-between"><span className="text-[#6b7085]">软件服务费（1%）</span><span className="text-[#d0d4e8]">¥{toy.software_service_fee || 0}</span></div>
                <div className="flex justify-between"><span className="text-[#6b7085]">基础软件服务费（0.6%）</span><span className="text-[#d0d4e8]">¥{toy.basic_software_service_fee || 0}</span></div>
                {(toy.worry_free_service_fee > 0) && <div className="flex justify-between"><span className="text-[#6b7085]">无忧卖服务费（2.5%）</span><span className="text-[#d0d4e8]">¥{toy.worry_free_service_fee}</span></div>}
                {(toy.huabei > 0) && <div className="flex justify-between"><span className="text-[#6b7085]">花呗扣款（3%）</span><span className="text-[#d0d4e8]">¥{toy.huabei}</span></div>}
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
                <input className="input text-xs" type="number" placeholder="0" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} />
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
              <input className="input text-xs" type="number" placeholder="0" value={form.return_cost} onChange={e => setForm({ ...form, return_cost: e.target.value })} />
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
        <h3 className="text-base font-bold">退换货 {toy.name}</h3>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">回收成本 (¥)</label>
            <input
              className="input"
              type="number"
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

export default function Warehouse() {
  const { toys, updateToy, deleteToy, setToast } = useStore();
  const [filter, setFilter] = useState('stock');
  const [search, setSearch] = useState('');
  const [selling, setSelling] = useState(null);
  const [editing, setEditing] = useState(null);
  const [returning, setReturning] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/settings/categories').then(cats => setCategories(cats)).catch(() => {});
  }, []);

  const filtered = toys.filter(t => {
    if (t.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name?.toLowerCase().includes(q) && !t.category?.toLowerCase().includes(q)) return false;
    }
    return t.status !== 'procurement' && t.status !== 'transit' && t.status !== 'preorder';
  });

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
    await updateToy(id, { ...toys.find(t => t.id === id), ...updates });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">仓库</h2>
          <p className="text-xs text-[#6b7085]">{filtered.length} 件商品</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowHistorical(true)}>
          + 录入历史销售
        </button>
      </div>

      <input
        className="input"
        placeholder="🔍 搜索商品..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${filter === f.key ? 'bg-accent text-[#0f1117] font-semibold' : 'bg-white/5 text-[#6b7085] hover:bg-white/10'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map(toy => (
          <ToyCard
            key={toy.id}
            toy={toy}
            onSell={toy => setSelling(toy)}
            onEdit={toy => setEditing(toy)}
            onReturn={toy => setReturning(toy)}
            onDone={id => updateToy(id, { ...toys.find(t => t.id === id), status: 'done' })}
            onDelete={id => setPendingDelete(id)}
          />
        ))}
      </div>

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

      {returning && (
        <ReturnModal
          toy={returning}
          onConfirm={confirmReturn}
          onCancel={() => setReturning(null)}
        />
      )}
    </div>
  );
}
