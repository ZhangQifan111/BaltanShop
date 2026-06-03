import { useState } from 'react';
import { api } from '../lib/api';
import useStore from '../stores/useStore';

const SOURCES = [
  { value: 'direct', label: '直购' },
  { value: 'proxy', label: '代购' },
];

// 切换进货渠道时自动套用的默认值
const SOURCE_DEFAULTS = {
  direct:     { handling_fee: '10', japan_domestic_shipping: '90', intl_shipping: '70', logistics_fee: '10', box_fee: '5', packing_fee: '5' },
  proxy:      { handling_fee: '0',  japan_domestic_shipping: '0',  intl_shipping: '70', logistics_fee: '10', box_fee: '5', packing_fee: '5' },
};

const initial = {
  source: 'direct',
  sell_price: '',
  profitMode: 'rate',
  profit_rate: '30',
  profit_amount: '',
  ...SOURCE_DEFAULTS.direct,
  huabei: '',
  refund_amount: '',
  japan_price_includes_tax: false,
  showAdvanced: false,
};

const num = (v) => (v === '' || v === null || v === undefined) ? 0 : Number(v);

export default function Estimate() {
  const setToast = useStore(s => s.setToast);
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const sell = num(form.sell_price);
    if (!(sell > 0)) {
      setToast('请填写目标售价');
      return;
    }
    const body = {
      source: form.source,
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
    if (form.fee_type) body.fee_type = form.fee_type;

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

          <div>
            <label className="text-xs text-[#6b7085] mb-1.5 block">进货渠道</label>
            <div className="grid grid-cols-4 gap-2">
              {SOURCES.map(s => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => setForm(f => ({ ...f, source: s.value, ...SOURCE_DEFAULTS[s.value] }))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    form.source === s.value
                      ? 'bg-accent text-[#0f1117]'
                      : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {form.source === 'direct' && (
            <div>
              <label className="text-xs text-[#6b7085] mb-1.5 block">日本零售价税模式</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => update('japan_price_includes_tax', false)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    !form.japan_price_includes_tax
                      ? 'bg-accent text-[#0f1117]'
                      : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10'
                  }`}
                >
                  不含税
                </button>
                <button
                  type="button"
                  onClick={() => update('japan_price_includes_tax', true)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    form.japan_price_includes_tax
                      ? 'bg-accent text-[#0f1117]'
                      : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10'
                  }`}
                >
                  含税
                </button>
              </div>
              <p className="text-[10px] text-[#6b7085] mt-1">
                不含税 → 消费税 = base × 10% 自动加；含税 → 标签价即基准
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-[#6b7085] mb-1.5 block">目标售价 (¥)</label>
            <input
              className="input text-sm"
              type="number"
              step="0.01"
              min="0"
              placeholder="例如 1000"
              value={form.sell_price}
              onChange={e => update('sell_price', e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-[#6b7085] mb-1.5 block">期望利润</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => update('profitMode', 'rate')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  form.profitMode === 'rate' ? 'bg-accent text-[#0f1117] font-medium' : 'bg-white/5 text-[#a0a4b8]'
                }`}
              >
                按利润率
              </button>
              <button
                type="button"
                onClick={() => update('profitMode', 'amount')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  form.profitMode === 'amount' ? 'bg-accent text-[#0f1117] font-medium' : 'bg-white/5 text-[#a0a4b8]'
                }`}
              >
                按金额
              </button>
            </div>
            {form.profitMode === 'rate' ? (
              <div className="relative">
                <input
                  className="input text-sm pr-8"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="30"
                  value={form.profit_rate}
                  onChange={e => update('profit_rate', e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6b7085]">%</span>
              </div>
            ) : (
              <input
                className="input text-sm"
                type="number"
                step="0.01"
                min="0"
                placeholder="例如 300"
                value={form.profit_amount}
                onChange={e => update('profit_amount', e.target.value)}
              />
            )}
          </div>

          <p className="text-[10px] text-[#6b7085]">
            平台手续费按售价 1.6% 自动算 (从售价扣减)
          </p>
        </div>

        <div className="card">
          <button
            type="button"
            onClick={() => update('showAdvanced', !form.showAdvanced)}
            className="flex items-center justify-between w-full"
          >
            <span className="text-xs text-[#6b7085] uppercase tracking-widest">
              费用明细 {form.showAdvanced ? '▾' : '▸'}
            </span>
            <span className="text-[10px] text-[#6b7085] normal-case">默认全为 0，按需填</span>
          </button>
          {form.showAdvanced && (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mb-2">日本境内</div>
                <div className="grid grid-cols-2 gap-3">
                  <FeeRow label="手续费" field="handling_fee" value={form.handling_fee} onChange={update} />
                  <FeeRow label="日本境内运费" field="japan_domestic_shipping" value={form.japan_domestic_shipping} onChange={update} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mb-2">国际段</div>
                <div className="grid grid-cols-2 gap-3">
                  <FeeRow label="国际运费" field="intl_shipping" value={form.intl_shipping} onChange={update} />
                </div>
                <p className="text-[10px] text-[#6b7085] mt-1">
                  海关税 13% 按 base 自动算 (进境商品: 直购/代购/二手；国内 = 0)
                </p>
              </div>
              <div>
                <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mb-2">大陆段</div>
                <div className="grid grid-cols-2 gap-3">
                  <FeeRow label="国内段物流" field="logistics_fee" value={form.logistics_fee} onChange={update} />
                  <FeeRow label="纸箱费" field="box_fee" value={form.box_fee} onChange={update} />
                  <FeeRow label="打包费" field="packing_fee" value={form.packing_fee} onChange={update} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mb-2">扣减</div>
                <div className="grid grid-cols-2 gap-3">
                  <FeeRow label="花呗分期" field="huabei" value={form.huabei} onChange={update} />
                  <FeeRow label="退款" field="refund_amount" value={form.refund_amount} onChange={update} />
                </div>
              </div>
            </div>
          )}
        </div>

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

function FeeRow({ label, field, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-[#6b7085] mb-1 block">{label}</label>
      <input
        className="input text-xs"
        type="number"
        step="0.01"
        min="0"
        placeholder="0"
        value={value}
        onChange={e => onChange(field, e.target.value)}
      />
    </div>
  );
}

function ResultCard({ result }) {
  const deductionsTotal = result.breakdown.deductions.refund + result.breakdown.deductions.huabei + result.breakdown.deductions.xFee;
  return (
    <div className="card">
      <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">估算结果</div>

      <div className="text-center py-5 mb-4 bg-accent/10 border border-accent/20 rounded-lg">
        <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mb-1">推荐进货基准价</div>
        <div className="text-4xl font-bold text-accent">¥{result.base_price.toFixed(2)}</div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-white/[0.03] rounded-lg">
          <div className="text-[10px] text-[#6b7085] mb-1">总成本</div>
          <div className="text-base font-bold">¥{result.cost.toFixed(2)}</div>
        </div>
        <div className="text-center p-2 bg-white/[0.03] rounded-lg">
          <div className="text-[10px] text-[#6b7085] mb-1">利润</div>
          <div className={`text-base font-bold ${result.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ¥{result.profit.toFixed(2)}
          </div>
        </div>
        <div className="text-center p-2 bg-white/[0.03] rounded-lg">
          <div className="text-[10px] text-[#6b7085] mb-1">利润率</div>
          <div className={`text-base font-bold ${result.profit_rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {result.profit_rate}%
          </div>
        </div>
      </div>

      {!result.feasible && result.warning && (
        <div className="mb-4 p-3 border border-red-500/30 rounded-lg bg-red-500/10 text-xs text-red-400">
          ⚠ {result.warning}
        </div>
      )}

      <div className="space-y-1 text-xs">
        <div className="text-[#6b7085] uppercase tracking-widest text-[10px] mb-2">费用明细</div>
        <Row label="进货基准价" value={result.breakdown.base} accent />
        <Row label="日本境内 (手续费+运费)" value={result.breakdown.japan_fees_excl_tax} />
        {result.breakdown.japan_consumption_tax > 0 && (
          <Row label="  消费税 (10% 自动)" value={result.breakdown.japan_consumption_tax} />
        )}
        <Row label="国际运费" value={result.breakdown.intl_shipping} />
        {result.breakdown.import_duty > 0 && (
          <Row label="  海关税 (13% 自动)" value={result.breakdown.import_duty} />
        )}
        <Row label="国内段物流" value={result.breakdown.logistics_fee} />
        <Row label="纸箱费" value={result.breakdown.box_fee} />
        <Row label="打包费" value={result.breakdown.packing_fee} />
        <div className="flex justify-between py-1.5 border-t border-white/[0.06]">
          <span className="text-[#6b7085]">费用合计</span>
          <span className="font-medium">¥{result.breakdown.fees_total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[#6b7085]">目标售价</span>
          <span className="font-medium">¥{result.breakdown.sell_price.toFixed(2)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[#6b7085] pl-3">平台手续费 (1.6%)</span>
          <span className="font-medium">¥{result.x_fee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[#6b7085]">扣减合计 (退款/花呗/平台费)</span>
          <span className="font-medium">¥{deductionsTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-[#6b7085]">{label}</span>
      <span className={accent ? 'text-accent font-bold' : 'font-medium'}>¥{value.toFixed(2)}</span>
    </div>
  );
}
