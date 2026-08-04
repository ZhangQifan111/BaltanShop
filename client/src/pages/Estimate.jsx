import { useState } from 'react';
import { api } from '../lib/api';
import useStore from '../stores/useStore';
import {
  ESTIMATE_DEFAULTS,
  num,
  SourcePicker,
  TaxModePicker,
  ProfitModePicker,
  ProfitInputs,
  AdvancedFeesPanel,
  ResultCard,
} from '../components/EstimateShared';
import { parseSource } from '../lib/sources';

const initial = {
  source: 'direct',
  sell_price: '',
  profitMode: 'rate',
  profit_rate: '30',
  profit_amount: '',
  ...ESTIMATE_DEFAULTS.direct,
  huabei: '',
  refund_amount: '',
  japan_price_includes_tax: false,
  showAdvanced: false,
};

export default function Estimate() {
  const setToast = useStore(s => s.setToast);
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const onSourceChange = (s) => setForm(f => ({ ...f, source: s, ...ESTIMATE_DEFAULTS[s] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const sell = num(form.sell_price);
    if (!(sell > 0)) {
      setToast('请填写目标售价');
      return;
    }
    const body = {
      source: parseSource(form.source).cat, // 归一化成 direct/proxy/domestic/secondhand
      sell_price: sell,
      handling_fee: num(form.handling_fee),
      japan_domestic_shipping: num(form.japan_domestic_shipping),
      japan_price_includes_tax: form.japan_price_includes_tax,
      intl_shipping: num(form.intl_shipping),
      logistics_fee: num(form.logistics_fee),
      box_fee: num(form.box_fee),
      packing_fee: num(form.packing_fee),
      huabei: num(form.huabei),
      refund_amount: num(form.refund_amount),
    };
    if (form.profitMode === 'rate') {
      body.profit_rate = num(form.profit_rate) / 100;
    } else {
      body.profit_amount = num(form.profit_amount);
    }

    setLoading(true);
    try {
      const r = await api.post('/toys/estimate', body);
      setResult(r);
    } catch (err) {
      setToast('估算失败: ' + err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(initial);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">进价估算</h2>
        <p className="text-xs text-[#6b7085]">已知目标售价 + 期望利润 + 各项费用，反推合理的进货基准价</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card space-y-4">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest">基本参数</div>

          <SourcePicker value={form.source} onChange={onSourceChange} />

          {form.source === 'direct' && (
            <TaxModePicker
              value={form.japan_price_includes_tax}
              onChange={(v) => update('japan_price_includes_tax', v)}
            />
          )}

          <div>
            <label className="text-xs text-[#6b7085] mb-1.5 block">目标售价 (¥)</label>
            <input
              className="input text-sm"
              type="text" inputmode="decimal"
              step="0.01"
              min="0"
              placeholder="例如 1000"
              value={form.sell_price}
              onChange={e => update('sell_price', e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-[#6b7085] mb-1.5 block">期望利润</label>
            <ProfitModePicker mode={form.profitMode} onChange={(m) => update('profitMode', m)} />
            <ProfitInputs
              mode={form.profitMode}
              rate={form.profit_rate}
              amount={form.profit_amount}
              onChange={update}
            />
          </div>

          <p className="text-[10px] text-[#6b7085]">
            平台手续费按售价 1.6% 自动算 (从售价扣减)
          </p>
        </div>

        <AdvancedFeesPanel
          form={form}
          update={update}
          open={form.showAdvanced}
          onToggle={() => update('showAdvanced', !form.showAdvanced)}
        />

        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={loading}>
            {loading ? '计算中…' : '计算进价'}
          </button>
          <button type="button" className="btn-ghost" onClick={handleReset}>重置</button>
        </div>
      </form>

      {result && <ResultCard result={result} />}
    </div>
  );
}
