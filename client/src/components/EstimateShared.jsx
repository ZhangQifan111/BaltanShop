/**
 * 反算（estimate）的共享 UI 组件与常量
 * Estimate.jsx（独立页）与 Monster.jsx（收藏卡弹窗）共用同一份，确保逻辑不漂移
 */
import { useState } from 'react';
import { SOURCE_CATEGORIES, toSourceValue, parseSource } from '../lib/sources';

// 切换进货渠道时自动套用的默认值
const DIRECT_DEFAULTS = { handling_fee: '10', japan_domestic_shipping: '90', intl_shipping: '70', logistics_fee: '10', box_fee: '5', packing_fee: '5' };
const PROXY_DEFAULTS  = { handling_fee: '5',  japan_domestic_shipping: '0',  intl_shipping: '70', logistics_fee: '10', box_fee: '5', packing_fee: '5' };
const DOMESTIC_DEFAULTS = { handling_fee: '0', japan_domestic_shipping: '0', intl_shipping: '0', logistics_fee: '10', box_fee: '5', packing_fee: '5' };

export const ESTIMATE_DEFAULTS = {
  direct:           DIRECT_DEFAULTS,
  proxy:            PROXY_DEFAULTS,
  '海淘-任你购':   DIRECT_DEFAULTS,
  '海淘-任意门':   DIRECT_DEFAULTS,
  '海淘-乐淘一番': DIRECT_DEFAULTS,
  '代购-四人帮':   PROXY_DEFAULTS,
  '代购-W':        PROXY_DEFAULTS,
  '代购-Z':        PROXY_DEFAULTS,
  '其他代购':      PROXY_DEFAULTS,
  domestic:         DOMESTIC_DEFAULTS,
  '咸鱼':           DOMESTIC_DEFAULTS,
  'vx好友':         DOMESTIC_DEFAULTS,
  secondhand:       { handling_fee: '0', japan_domestic_shipping: '0', intl_shipping: '70', logistics_fee: '10', box_fee: '5', packing_fee: '5' },
};

export const num = (v) => (v === '' || v === null || v === undefined) ? 0 : Number(v);

export function FeeRow({ label, field, value, onChange, placeholder = '0' }) {
  return (
    <div>
      <label className="text-[10px] text-[#6b7085] mb-1 block">{label}</label>
      <input
        className="input text-xs"
        type="text" inputmode="decimal"
        step="0.01"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(field, e.target.value)}
      />
    </div>
  );
}

export function SourcePicker({ value, onChange }) {
  const parsed = parseSource(value);
  const [cat, setCat] = useState(parsed.cat);
  const [detail, setDetail] = useState(parsed.detail);
  const currentCat = SOURCE_CATEGORIES.find(c => c.key === cat);

  const handleCat = (c) => {
    setCat(c.key);
    if (c.type === 'simple') {
      setDetail(null);
      onChange(c.key);
    } else {
      const first = c.items[0].key;
      setDetail(first);
      onChange(toSourceValue(c.key, first));
    }
  };

  return (
    <div>
      <label className="text-xs text-[#6b7085] mb-1.5 block">进货渠道</label>
      <div className="flex flex-wrap gap-2">
        {SOURCE_CATEGORIES.map(c => (
          <button
            type="button"
            key={c.key}
            onClick={() => handleCat(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              c.key === cat
                ? 'bg-accent text-[#0f1117]'
                : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {currentCat?.type === 'group' && (
        <div className="flex flex-wrap gap-2 mt-2">
          {currentCat.items.map(d => (
            <button
              type="button"
              key={d.key}
              onClick={() => { setDetail(d.key); onChange(toSourceValue(cat, d.key)); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                d.key === detail
                  ? 'bg-accent/70 text-[#0f1117]'
                  : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaxModePicker({ value, onChange }) {
  return (
    <div>
      <label className="text-xs text-[#6b7085] mb-1.5 block">日本零售价税模式</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            !value
              ? 'bg-accent text-[#0f1117]'
              : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10'
          }`}
        >
          不含税
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            value
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
  );
}

export function ProfitModePicker({ mode, onChange }) {
  return (
    <div className="flex gap-2 mb-2">
      <button
        type="button"
        onClick={() => onChange('rate')}
        className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
          mode === 'rate' ? 'bg-accent text-[#0f1117] font-medium' : 'bg-white/5 text-[#a0a4b8]'
        }`}
      >
        按利润率
      </button>
      <button
        type="button"
        onClick={() => onChange('amount')}
        className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
          mode === 'amount' ? 'bg-accent text-[#0f1117] font-medium' : 'bg-white/5 text-[#a0a4b8]'
        }`}
      >
        按金额
      </button>
    </div>
  );
}

export function ProfitInputs({ mode, rate, amount, onChange }) {
  if (mode === 'rate') {
    return (
      <div className="relative">
        <input
          className="input text-sm pr-8"
          type="text" inputmode="decimal"
          step="0.1"
          min="0"
          max="100"
          placeholder="30"
          value={rate}
          onChange={e => onChange('profit_rate', e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6b7085]">%</span>
      </div>
    );
  }
  return (
    <input
      className="input text-sm"
      type="text" inputmode="decimal"
      step="0.01"
      min="0"
      placeholder="例如 300"
      value={amount}
      onChange={e => onChange('profit_amount', e.target.value)}
    />
  );
}

export function AdvancedFeesPanel({ form, update, open, onToggle }) {
  return (
    <div className="card">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full"
      >
        <span className="text-xs text-[#6b7085] uppercase tracking-widest">
          费用明细 {open ? '▾' : '▸'}
        </span>
        <span className="text-[10px] text-[#6b7085] normal-case">默认全为 0，按需填</span>
      </button>
      {open && (
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

/**
 * 反算结果展示
 * footer?: ReactNode — 让 Monster.jsx 在结果下方追加专属动作按钮（录入/保存参考价）
 */
export function ResultCard({ result, footer }) {
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

      {footer && <div className="mt-4 pt-3 border-t border-white/5 space-y-2">{footer}</div>}
    </div>
  );
}
