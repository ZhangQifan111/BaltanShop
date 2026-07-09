import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import useStore from '../stores/useStore';
import { sourceLabel, sourceGroup, SOURCE_CATEGORIES, toSourceValue, parseSource } from '../lib/sources';
import ImageModal from '../components/ImageModal';
import Xplus from './Xplus';
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

const SERIES_LABELS = {
  'ultraman': '初代',
  'return-of-ultraman': '归曼',
  'ultraseven': '赛文',
  'ultraman-ace': '艾斯',
  'ultraman-leo': '雷欧',
  'ultramantaro': '太郎',
  'ultraman80': '80',
  'ultraq': '奥特Q',
  'others': '其他',
  'ultrafight': '格斗',
  'custom': '自定义',
};

// 录入弹窗的渠道默认费用（按 stage 阶段付款，与反算的 ESTIMATE_DEFAULTS 是不同字段集）
const DIRECT_SOURCE_DEFAULTS = { stage2_handling: 10, stage2_domestic_ship: 90, stage3_intl_ship: 70, logistics_fee: 10, box_fee: 5, packing_fee: 5 };
const PROXY_SOURCE_DEFAULTS = { stage2_handling: 0, stage2_domestic_ship: 0, stage3_intl_ship: 70, logistics_fee: 10, box_fee: 5, packing_fee: 5 };
const DOMESTIC_SOURCE_DEFAULTS = { stage2_handling: 0, stage2_domestic_ship: 0, stage3_intl_ship: 0, logistics_fee: 10, box_fee: 5, packing_fee: 5 };

const SOURCE_DEFAULTS = {
  direct: DIRECT_SOURCE_DEFAULTS,
  proxy:  PROXY_SOURCE_DEFAULTS,
  '海淘-任你购': DIRECT_SOURCE_DEFAULTS,
  '海淘-任意门': DIRECT_SOURCE_DEFAULTS,
  '海淘-乐淘一番': DIRECT_SOURCE_DEFAULTS,
  '代购-四人帮': PROXY_SOURCE_DEFAULTS,
  '代购-W': PROXY_SOURCE_DEFAULTS,
  '代购-Z': PROXY_SOURCE_DEFAULTS,
  '其他代购': PROXY_SOURCE_DEFAULTS,
  domestic: DOMESTIC_SOURCE_DEFAULTS,
  '咸鱼': DOMESTIC_SOURCE_DEFAULTS,
  'vx好友': DOMESTIC_SOURCE_DEFAULTS,
  secondhand: { stage2_handling: 0, stage2_domestic_ship: 0, stage3_intl_ship: 70, logistics_fee: 10, box_fee: 5, packing_fee: 5 },
};

function SeriesTab({ s, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'text-xs px-3 py-1.5 rounded-full transition-colors ' +
        (active
          ? 'bg-accent text-[#0f1117] font-semibold'
          : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10 border border-white/10')
      }
    >
      {SERIES_LABELS[s.series] || s.series}
      <span className="ml-1.5 text-[10px] opacity-70">{s.toys}</span>
    </button>
  );
}

function StarButton({ active, onClick, size = 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-sm' : 'w-9 h-9 text-base';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      title={active ? '取消收藏' : '收藏'}
      className={
        dim + ' rounded-full flex items-center justify-center leading-none select-none ' +
        'transition-all duration-150 active:scale-90 hover:scale-110 ' +
        (active
          ? 'bg-yellow-400 text-[#0f1117] shadow-md shadow-yellow-500/50 ring-2 ring-yellow-300/80'
          : 'bg-black/45 backdrop-blur-sm text-white/85 hover:bg-black/65 hover:text-white border border-white/15')
      }
    >
      {active ? '★' : '☆'}
    </button>
  );
}

function CustomBadge() {
  return (
    <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
      🛠 自定义
    </span>
  );
}

function CharacterCard({ c, onClick, isFav }) {
  const initial = (c.character_slug || '?').charAt(0).toUpperCase();

  return (
    <div
      className={
        'card overflow-hidden text-left transition-all duration-150 flex flex-col relative ' +
        (isFav
          ? 'ring-2 ring-yellow-400/70 shadow-lg shadow-yellow-500/15'
          : 'hover:ring-1 hover:ring-accent/40')
      }
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col flex-1 text-left"
      >
        {c.thumbnail_url ? (
          <img
            src={c.thumbnail_url}
            alt={c.character_name_ja || c.character_slug}
            className="block w-full h-auto object-contain bg-black/30"
            style={{ aspectRatio: '100 / 147' }}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full bg-black/30 flex items-center justify-center text-3xl font-bold text-[#6b7085]"
            style={{ aspectRatio: '100 / 147' }}
          >
            {initial}
          </div>
        )}
        <div className="p-3 flex-1 flex flex-col gap-1 min-w-0">
          <div className="text-base font-bold text-accent truncate">
            {c.character_name_zh || c.character_slug}
          </div>
          <div className="text-[11px] text-[#a0a4b8] truncate">
            {c.character_name_ja}
          </div>
          <div className="text-xs text-[#6b7085] mt-auto">
            {c.toy_count} 件 {c.has_custom ? '· 含自定义' : ''}
          </div>
        </div>
      </button>
    </div>
  );
}

function EstimateForm({ item, onClose, onUseForAdd, onSaveAsReference }) {
  const [form, setForm] = useState({
    source: 'direct',
    sell_price: '1000',
    profitMode: 'rate',
    profit_rate: '20',
    profit_amount: '',
    ...ESTIMATE_DEFAULTS.direct,
    huabei: '0',
    refund_amount: '0',
    japan_price_includes_tax: false,
    showAdvanced: false,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const onSourceChange = (s) => setForm(f => ({ ...f, source: s, ...ESTIMATE_DEFAULTS[s] }));

  const calc = async () => {
    const sell = num(form.sell_price);
    if (!(sell > 0)) {
      setResult({ error: '请填写目标售价' });
      return;
    }
    setLoading(true);
    try {
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
      const r = await api.post('/toys/estimate', body);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(f => ({
      source: f.source,
      sell_price: '1000',
      profitMode: 'rate',
      profit_rate: '20',
      profit_amount: '',
      ...ESTIMATE_DEFAULTS[f.source],
      huabei: '0',
      refund_amount: '0',
      japan_price_includes_tax: false,
      showAdvanced: false,
    }));
    setResult(null);
  };

  const showFooterActions = result && !result.error && (onUseForAdd || onSaveAsReference);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); calc(); }}
      className="space-y-3"
    >
      <div className="card space-y-3">
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
          {loading ? '计算中…' : '反算购入价'}
        </button>
        <button type="button" className="btn-ghost" onClick={handleReset}>重置</button>
        <button type="button" className="btn-ghost" onClick={onClose}>收起</button>
      </div>

      {result && !result.error && (
        <ResultCard
          result={result}
          footer={
            showFooterActions && (
              <>
                {onUseForAdd && result.feasible && (
                  <button
                    type="button"
                    onClick={() => onUseForAdd(result.base_price)}
                    className="w-full px-3 py-2 rounded-lg bg-emerald-500 text-[#0f1117] text-xs font-semibold hover:bg-emerald-400"
                  >
                    ➕ 用 ¥{result.base_price.toFixed(0)} 录入库存
                  </button>
                )}
                {onSaveAsReference && result.feasible && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try { await onSaveAsReference(result.base_price); }
                      finally { setSaving(false); }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-yellow-500 text-[#0f1117] text-xs font-semibold hover:bg-yellow-400 disabled:opacity-50"
                  >
                    {saving ? '保存中…' : `★ 保存为购入参考价 ¥${result.base_price.toFixed(0)}`}
                  </button>
                )}
              </>
            )
          }
        />
      )}

      {result?.error && (
        <div className="text-red-400 text-[10px]">{result.error}</div>
      )}
    </form>
  );
}

const TOY_STATUS_LABELS = { stock: '在库', sold: '已发货', done: '已完成', procurement: '采购中', transit: '在途', preorder: '预购', returned: '已退' };

function LinkPickerModal({ character_slug, ref_id, currentLinkedId, onLinked, onUnlinked, onClose }) {
  const { toys, setToast } = useStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(null);

  const filtered = [...toys]
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.name?.toLowerCase().includes(q)
        || t.name_zh?.toLowerCase().includes(q)
        || t.category?.toLowerCase().includes(q);
    });

  const handleLink = async (toy) => {
    setLoading(toy.id);
    try {
      await api.post('/monster/favorites/link-toy', { character_slug, ref_id, toy_id: toy.id });
      setToast('已关联 ' + toy.name);
      onLinked();
    } catch (e) {
      setToast('关联失败: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleUnlink = async () => {
    setLoading('unlink');
    try {
      await api.post('/monster/favorites/unlink-toy', { character_slug, ref_id });
      setToast('已解除关联');
      onUnlinked();
    } catch (e) {
      setToast('解除失败: ' + e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-5 w-full max-w-md flex flex-col" style={{ height: '85vh' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold">关联已有库存</h3>
        {currentLinkedId && (
          <button
            type="button"
            onClick={handleUnlink}
            disabled={loading === 'unlink'}
            className="text-xs text-red-300 hover:underline disabled:opacity-50 self-end -mt-5"
          >
            {loading === 'unlink' ? '解除中…' : '解除当前关联'}
          </button>
        )}
        <p className="text-[10px] text-[#6b7085] mt-2">挑一件已有的 toys 记录关联到这个 ref。选了之后该收藏会自动从「收藏」视图搬到「已拥有」视图。</p>

        <input
          className="input text-sm mt-2"
          placeholder="🔍 搜索商品名称 / 品类…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        <div className="flex-1 min-h-0 overflow-y-auto mt-2 -mx-1 px-1 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-xs text-[#6b7085] text-center py-6">没有匹配的商品</div>
          ) : filtered.map(toy => {
            const isCurrent = toy.id === currentLinkedId;
            const status = TOY_STATUS_LABELS[toy.status] || toy.status;
            return (
              <button
                key={toy.id}
                type="button"
                onClick={() => !isCurrent && handleLink(toy)}
                disabled={isCurrent || loading !== null}
                className={
                  'w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center gap-3 transition-colors ' +
                  (isCurrent
                    ? 'border-emerald-500/50 bg-emerald-500/10 cursor-default'
                    : 'border-white/5 hover:bg-white/5 cursor-pointer')
                }
              >
                {toy.image ? (
                  <img src={toy.image} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-white/5" onError={e => e.target.style.display = 'none'} />
                ) : (
                  <div className="w-10 h-10 rounded shrink-0 bg-white/5 flex items-center justify-center text-[9px] text-[#6b7085]">无图</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{toy.name_zh || toy.name}</div>
                  {toy.name_zh && <div className="text-[10px] text-[#6b7085] truncate">{toy.name}</div>}
                  <div className="text-[10px] text-[#6b7085] mt-0.5">
                    {toy.category || '-'} · {status} · {sourceLabel(toy.source)} · ¥{(toy.total_cost || 0).toFixed(0)}
                  </div>
                </div>
                {isCurrent ? (
                  <span className="text-emerald-300 text-[10px] shrink-0">✓ 已关联</span>
                ) : loading === toy.id ? (
                  <span className="text-[10px] shrink-0">关联中…</span>
                ) : (
                  <span className="text-emerald-300 text-[10px] shrink-0">选择</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}

function AddForm({ item, onClose, onAdded, addToy, initialAmount = '' }) {
  const nn = item.ref_id.split('-').pop();
  const displayName = item.character_name_zh || item.character_slug || '';
  const defaultName = `${displayName} #${nn} ${item.source}`;
  const [form, setForm] = useState({
    name: defaultName,
    source: 'direct',
    status: 'stock',
    stage1_amount: initialAmount ? String(initialAmount) : '',
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: '',
    baltan_ref_id: item.ref_id,
    ...SOURCE_DEFAULTS.direct,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setErr(null);
    try {
      const body = {
        name: form.name,
        source: form.source,
        status: form.status,
        purchase_date: form.purchase_date || null,
        notes: form.notes || null,
        baltan_ref_id: form.baltan_ref_id || null,
        stage1_amount: num(form.stage1_amount),
        stage1_date: form.purchase_date || null,
        stage2_handling: num(form.stage2_handling),
        stage2_domestic_ship: num(form.stage2_domestic_ship),
        stage3_intl_ship: num(form.stage3_intl_ship),
        logistics_fee: num(form.logistics_fee),
        box_fee: num(form.box_fee),
        packing_fee: num(form.packing_fee),
      };
      body.stage3_tax = Math.round(body.stage1_amount * 0.13 * 100) / 100;
      body.stage2_amount = body.stage2_handling + body.stage2_domestic_ship;
      body.stage3_amount = body.stage3_intl_ship + body.stage3_tax;
      body.stage2_date = body.stage3_date = form.purchase_date || null;

      await addToy(body);
      onAdded();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isDirect = form.source === 'direct';
  const computedTax = Math.round(num(form.stage1_amount) * 0.13 * 100) / 100;
  const computedStage2 = num(form.stage2_handling) + num(form.stage2_domestic_ship);
  const computedStage3 = num(form.stage3_intl_ship) + computedTax;

  return (
    <div className="mt-2 p-3 rounded-lg bg-black/30 border border-white/10 space-y-2 text-xs">
      <div>
        <span className="text-[9px] text-[#6b7085] block mb-0.5">名称</span>
        <input
          type="text"
          value={form.name}
          onChange={e => update('name', e.target.value)}
          className="input text-xs w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">渠道</span>
          <div className="space-y-1.5">
            <select
              value={parseSource(form.source).cat}
              onChange={e => {
                const c = SOURCE_CATEGORIES.find(x => x.key === e.target.value);
                if (c && c.type === 'simple') {
                  setForm(f => ({ ...f, source: c.key, ...SOURCE_DEFAULTS[c.key] }));
                } else if (c) {
                  const d = c.items[0].key;
                  const s = toSourceValue(c.key, d);
                  setForm(f => ({ ...f, source: s, ...SOURCE_DEFAULTS[s] }));
                }
              }}
              className="input text-xs w-full"
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
                    value={curDetail || ''}
                    onChange={e => {
                      const s = toSourceValue(cur.key, e.target.value);
                      setForm(f => ({ ...f, source: s, ...SOURCE_DEFAULTS[s] }));
                    }}
                    className="input text-xs w-full"
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
          <span className="text-[9px] text-[#6b7085] block mb-0.5">状态</span>
          <select
            value={form.status}
            onChange={e => update('status', e.target.value)}
            className="input text-xs w-full"
          >
            <option value="procurement">采购中</option>
            <option value="transit">在途</option>
            <option value="stock">在库</option>
          </select>
        </div>
      </div>

      <div className="pt-1.5 border-t border-white/5">
        <div className="text-[10px] text-[#6b7085] mb-1">① 买货成本</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">
              {isDirect ? '商品价 (¥)' : '代购价 (¥)'}
            </span>
            <input
              type="text" inputmode="decimal"
              value={form.stage1_amount}
              onChange={e => update('stage1_amount', e.target.value)}
              placeholder="0"
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">购入日期</span>
            <input
              type="date"
              value={form.purchase_date}
              onChange={e => update('purchase_date', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
        </div>
      </div>

      <div className="pt-1.5 border-t border-white/5">
        <div className="text-[10px] text-[#6b7085] mb-1">② 国内中转</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">手续费 (¥)</span>
            <input
              type="text" inputmode="decimal"
              value={form.stage2_handling}
              onChange={e => update('stage2_handling', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">
              {isDirect ? '日本境内运费 (¥)' : '国内运费 (¥)'}
            </span>
            <input
              type="text" inputmode="decimal"
              value={form.stage2_domestic_ship}
              onChange={e => update('stage2_domestic_ship', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">小计 (¥)</span>
            <input
              type="text"
              value={computedStage2.toFixed(0)}
              readOnly
              className="input text-xs w-full bg-black/20 cursor-default"
            />
          </div>
        </div>
      </div>

      <div className="pt-1.5 border-t border-white/5">
        <div className="text-[10px] text-[#6b7085] mb-1">③ 国际段</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">国际运费 (¥)</span>
            <input
              type="text" inputmode="decimal"
              value={form.stage3_intl_ship}
              onChange={e => update('stage3_intl_ship', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">海关税 (¥)</span>
            <input
              type="text"
              value={computedTax.toFixed(2)}
              readOnly
              className="input text-xs w-full bg-black/20 cursor-default"
              title="按购入价的 13% 自动计算"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">小计 (¥)</span>
            <input
              type="text"
              value={computedStage3.toFixed(0)}
              readOnly
              className="input text-xs w-full bg-black/20 cursor-default"
            />
          </div>
        </div>
      </div>

      <div className="pt-1.5 border-t border-white/5">
        <div className="text-[10px] text-[#6b7085] mb-1">仓储发货</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">国内物流 (¥)</span>
            <input
              type="text" inputmode="decimal"
              value={form.logistics_fee}
              onChange={e => update('logistics_fee', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">纸箱费 (¥)</span>
            <input
              type="text" inputmode="decimal"
              value={form.box_fee}
              onChange={e => update('box_fee', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">打包费 (¥)</span>
            <input
              type="text" inputmode="decimal"
              value={form.packing_fee}
              onChange={e => update('packing_fee', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
        </div>
      </div>

      <div>
        <span className="text-[9px] text-[#6b7085] block mb-0.5">备注</span>
        <input
          type="text"
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          className="input text-xs w-full"
        />
      </div>

      <div className="pt-1.5 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-[#6b7085]">预估总成本</span>
        <span className="text-base font-bold text-accent">
          ¥{(num(form.stage1_amount) + computedStage2 + computedStage3 + num(form.logistics_fee) + num(form.box_fee) + num(form.packing_fee)).toFixed(0)}
        </span>
      </div>

      {err && <div className="text-red-400 text-[10px]">{err}</div>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-accent text-[#0f1117] text-xs font-medium disabled:opacity-50"
        >
          {loading ? '保存中…' : '保存入库'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-white/5 text-[#a0a4b8] text-xs"
        >
          收起
        </button>
      </div>
    </div>
  );
}

/* ─── 客户端图片压缩 + EXIF 矫正（iOS 拍照用） ─── */
const MAX_DIMENSION = 1600;        // 最大边长（商品展示足够，肉眼难辨差异）
const JPEG_QUALITY = 0.85;          // 压缩质量（视觉无损）
const TARGET_BYTES = 1.5 * 1024 * 1024; // 目标压缩后 ≤1.5MB（避开 10MB JSON limit）
const ACCEPT_BYTES = 20 * 1024 * 1024;  // 接受原始 ≤20MB 的图

/**
 * 压缩图片：EXIF 自动旋转 + resize + JPEG 压缩。
 * @param {File} file - 原始 File 对象
 * @returns {Promise<{blob: Blob, width: number, height: number, srcWidth: number, srcHeight: number, srcBytes: number}>}
 */
async function compressImage(file) {
  // 1. 解码（createImageBitmap 自动应用 EXIF orientation，iOS 16.4+）
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // 回退：老 iOS 用 <img> 加载（但拿不到 EXIF rotation，方向可能还是错的）
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('图片解码失败'));
        i.src = url;
      });
      bitmap = await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;

  // 2. 计算 resize 后尺寸（等比缩放，最大边 ≤ MAX_DIMENSION）
  let dstW = srcW;
  let dstH = srcH;
  if (Math.max(srcW, srcH) > MAX_DIMENSION) {
    const k = MAX_DIMENSION / Math.max(srcW, srcH);
    dstW = Math.round(srcW * k);
    dstH = Math.round(srcH * k);
  }

  // 3. canvas 重绘（EXIF 旋转在 createImageBitmap 步骤已应用，这里画出来方向是对的）
  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);
  bitmap.close?.();

  // 4. 转 Blob（JPEG）
  let blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob 失败')), 'image/jpeg', JPEG_QUALITY);
  });

  // 5. 如果还超 TARGET_BYTES，再降一档（缩到 1280px）
  if (blob.size > TARGET_BYTES && Math.max(dstW, dstH) > 1280) {
    const k2 = 1280 / Math.max(dstW, dstH);
    const w2 = Math.round(dstW * k2);
    const h2 = Math.round(dstH * k2);
    canvas.width = w2;
    canvas.height = h2;
    ctx.drawImage(canvas, 0, 0, w2, h2); // 注意：这里是从小canvas画到小canvas会有锯齿，但能接受
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas.toBlob 失败')), 'image/jpeg', JPEG_QUALITY);
    });
    dstW = w2;
    dstH = h2;
  }

  return { blob, width: dstW, height: dstH, srcWidth: srcW, srcHeight: srcH, srcBytes: file.size };
}

function ImageUploader({ value, onChange, characterSlug, setToast }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null); // {src, dst, w, h}

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!characterSlug || !characterSlug.trim()) {
      setToast('请先填角色 slug 再上传图');
      return;
    }
    if (file.size > ACCEPT_BYTES) {
      setToast(`原图太大 (${(file.size/1024/1024).toFixed(1)}MB)，请先在相册里压缩到 20MB 以下`);
      return;
    }
    setUploading(true);
    setProgress({ src: file.size, dst: 0, w: 0, h: 0 });
    try {
      // 1. 客户端压缩（EXIF 矫正 + resize + JPEG 压缩）
      const { blob, width, height, srcWidth, srcHeight, srcBytes } = await compressImage(file);
      setProgress({ src: srcBytes, dst: blob.size, w: width, h: height, srcW: srcWidth, srcH: srcHeight });

      // 2. 转 base64
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('读取文件失败'));
        r.readAsDataURL(blob);
      });

      // 3. 上传
      const r = await api.post('/monster/upload-image', {
        character_slug: characterSlug.trim(),
        data: b64,
      });
      onChange(r.image_url);
      const srcKB = (srcBytes/1024).toFixed(0);
      const dstKB = (blob.size/1024).toFixed(0);
      const ratio = srcBytes > 0 ? ((1 - blob.size/srcBytes) * 100).toFixed(0) : 0;
      setToast(`已上传 ${srcKB}KB→${dstKB}KB (-${ratio}%) ${width}×${height}`);
    } catch (err) {
      setToast('上传失败: ' + err.message);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder="https://… 或点下方按钮拍照/选图"
        className="input text-xs w-full" />
      <div className="flex items-center gap-2">
        <label className={
          'cursor-pointer text-[10px] px-2 py-1 rounded border ' +
          (uploading
            ? 'bg-white/5 text-[#6b7085] border-white/10 cursor-wait'
            : 'bg-white/5 text-[#a0a4b8] hover:bg-white/10 border-white/10')
        }>
          {uploading ? '↑ 处理中…' : '📷 拍照 / 选图'}
          <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
        {value && (
          <img src={value} alt="" className="h-10 w-10 object-cover rounded border border-white/10 bg-black/30" />
        )}
      </div>
      {uploading && progress && (
        <div className="text-[10px] text-[#6b7085] space-y-0.5">
          <div>原图: {(progress.src/1024).toFixed(0)}KB {progress.srcW && progress.srcH ? `(${progress.srcW}×${progress.srcH})` : '解码中…'}</div>
          {progress.dst > 0 && (
            <div>压缩后: {(progress.dst/1024).toFixed(0)}KB ({progress.w}×{progress.h}) · 节省 {((1 - progress.dst/progress.src) * 100).toFixed(0)}%</div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomToyForm({ defaultCharacter, onClose, onAdded, setToast }) {
  const [form, setForm] = useState({
    name: '',
    source: 'custom',
    brand: '',
    image_url: '',
    detail_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('名称必填'); return; }
    setLoading(true); setErr(null);
    try {
      const r = await api.post('/monster/custom-toy', {
        character_slug: defaultCharacter.character_slug,
        name: form.name.trim(),
        source: form.source,
        brand: form.brand.trim() || null,
        image_url: form.image_url.trim() || null,
        detail_url: form.detail_url.trim() || null,
      });
      setToast(`已添加 ${r.ref_id}`);
      onAdded();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2 text-xs">
      <div className="text-amber-300 text-[10px]">+ 第三方玩具 · 归属角色：{defaultCharacter.character_name_zh || defaultCharacter.character_slug}</div>
      <div>
        <span className="text-[9px] text-[#6b7085] block mb-0.5">名称 *</span>
        <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
          placeholder="例: 海洋堂 食玩 グビラ"
          className="input text-xs w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">厂家/品牌</span>
          <input type="text" value={form.brand} onChange={e => update('brand', e.target.value)}
            className="input text-xs w-full" />
        </div>
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">类型</span>
          <input type="text" value={form.source} onChange={e => update('source', e.target.value)}
            placeholder="custom / sofvi / figure …"
            className="input text-xs w-full" />
        </div>
      </div>
      <div>
        <span className="text-[9px] text-[#6b7085] block mb-0.5">图片（贴 URL 或选本地文件）</span>
        <ImageUploader
          value={form.image_url}
          onChange={v => update('image_url', v)}
          characterSlug={defaultCharacter.character_slug}
          setToast={setToast}
        />
      </div>
      <div>
        <span className="text-[9px] text-[#6b7085] block mb-0.5">考据链接（可选）</span>
        <input type="text" value={form.detail_url} onChange={e => update('detail_url', e.target.value)}
          className="input text-xs w-full" />
      </div>
      {err && <div className="text-red-400 text-[10px]">{err}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={loading}
          className="px-3 py-1.5 rounded bg-amber-500 text-[#0f1117] text-xs font-medium disabled:opacity-50">
          {loading ? '保存中…' : '保存'}
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-1.5 rounded bg-white/5 text-[#a0a4b8] text-xs">取消</button>
      </div>
    </div>
  );
}

function CustomCharacterForm({ defaultSeries, onClose, onAdded, setToast }) {
  const [form, setForm] = useState({
    character_slug: '',
    character_name_ja: '',
    character_name_zh: '',
    series: defaultSeries || 'custom',
    first_toy_name: '',
    brand: '',
    image_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const slug = form.character_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!slug || !form.character_name_ja.trim() || !form.first_toy_name.trim()) {
      setErr('slug、日文名、首个玩具名都必填');
      return;
    }
    setLoading(true); setErr(null);
    try {
      const r = await api.post('/monster/custom-character', {
        character_slug: slug,
        character_name_ja: form.character_name_ja.trim(),
        character_name_zh: form.character_name_zh.trim() || null,
        series: form.series.trim() || 'custom',
        first_toy: {
          name: form.first_toy_name.trim(),
          brand: form.brand.trim() || null,
          image_url: form.image_url.trim() || null,
        },
      });
      setToast(`已创建 ${r.character_slug}`);
      onAdded(r.series);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2 text-xs">
      <div className="text-amber-300 text-[10px]">+ 第三方角色（自定义）</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">slug * (英文/数字/-)</span>
          <input type="text" value={form.character_slug} onChange={e => update('character_slug', e.target.value)}
            placeholder="mykaiju-01"
            className="input text-xs w-full" />
        </div>
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">日文名 *</span>
          <input type="text" value={form.character_name_ja} onChange={e => update('character_name_ja', e.target.value)}
            className="input text-xs w-full" />
        </div>
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">中文名</span>
          <input type="text" value={form.character_name_zh} onChange={e => update('character_name_zh', e.target.value)}
            className="input text-xs w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">归属系列</span>
          <input type="text" value={form.series} onChange={e => update('series', e.target.value)}
            placeholder="ultraman / custom …"
            className="input text-xs w-full" />
        </div>
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">首个玩具名 *</span>
          <input type="text" value={form.first_toy_name} onChange={e => update('first_toy_name', e.target.value)}
            className="input text-xs w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">厂家/品牌</span>
          <input type="text" value={form.brand} onChange={e => update('brand', e.target.value)}
            className="input text-xs w-full" />
        </div>
        <div>
          <span className="text-[9px] text-[#6b7085] block mb-0.5">首个玩具图片（贴 URL 或选本地文件）</span>
          <ImageUploader
            value={form.image_url}
            onChange={v => update('image_url', v)}
            characterSlug={form.character_slug}
            setToast={setToast}
          />
        </div>
      </div>
      {err && <div className="text-red-400 text-[10px]">{err}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={loading}
          className="px-3 py-1.5 rounded bg-amber-500 text-[#0f1117] text-xs font-medium disabled:opacity-50">
          {loading ? '创建中…' : '创建角色'}
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-1.5 rounded bg-white/5 text-[#a0a4b8] text-xs">取消</button>
      </div>
    </div>
  );
}

function ToyFormModal({ item, type, onClose, onAdded, addToy, initialAmount = '', onUseForAdd, onSaveAsReference }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isAdd = type === 'add';
  const nn = item.ref_id.split('-').pop();
  const title = isAdd ? '录入库存' : '反算购入价';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161924] border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {item.image_url && (
              <img
                src={item.image_url}
                alt=""
                className="w-10 h-14 object-contain bg-black/30 rounded shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-white">{title}</div>
              <div className="text-xs text-[#a0a4b8] truncate">
                {item.character_name_zh || item.character_slug} #{nn} {item.source}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xl text-[#a0a4b8] hover:text-white hover:bg-white/10 shrink-0"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {isAdd ? (
            <AddForm
              key={item.ref_id}
              item={item}
              onClose={onClose}
              onAdded={onAdded}
              addToy={addToy}
              initialAmount={initialAmount}
            />
          ) : (
            <EstimateForm
              key={item.ref_id}
              item={item}
              onClose={onClose}
              onUseForAdd={onUseForAdd}
              onSaveAsReference={onSaveAsReference}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToyCard({ it, onZoom, onOpenForm, addToy, isFav, onToggleFav, referencePrice, onEditReference, onClearReference, onOpenLinkPicker, onDelete, setToast }) {
  const hasOwned = it.owned && it.owned.length > 0;
  const isLinked = !!it.linked_toy_id;
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef(null);

  const handleDelete = async () => {
    if (isLinked) {
      setToast('该玩具已关联库存，请先解除关联再删');
      return;
    }
    if (!confirm(`确定删除自定义玩具「${it.source || it.ref_id}」？此操作只删图鉴条目，不会动到已有库存。`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (e) {
      setToast('删除失败: ' + e.message);
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!addMenuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [addMenuOpen]);

  return (
    <div
      className={
        'card overflow-hidden flex flex-col relative transition-all duration-150 ' +
        (isFav ? 'ring-2 ring-yellow-400/70 shadow-lg shadow-yellow-500/15' : '')
      }
    >
      {it.image_url ? (
        <button
          type="button"
          onClick={onZoom}
          className="bg-black/30 cursor-zoom-in hover:opacity-80 transition-opacity"
        >
          <img
            src={it.image_url}
            alt={`${it.character_name_zh || it.character_slug} ${it.source}`}
            className="block w-full h-auto object-contain"
            style={{ aspectRatio: '100 / 147' }}
            loading="lazy"
          />
        </button>
      ) : (
        <div
          className="w-full bg-black/30 flex items-center justify-center text-[10px] text-[#6b7085]"
          style={{ aspectRatio: '100 / 147' }}
        >
          无图
        </div>
      )}
      <div className="absolute top-2 right-2 z-10">
        <StarButton active={isFav} onClick={onToggleFav} />
      </div>
      <div className="p-2.5 flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs text-accent">#{it.ref_id.split('-').pop()}</span>
          <span className="text-[10px] text-[#6b7085] truncate">{it.source}</span>
          {it.is_custom ? <CustomBadge /> : null}
        </div>
        {hasOwned && (
          <div className="space-y-0.5">
            {it.owned.map(o => (
              <div key={o.id} className="text-[11px] text-[#a0a4b8] flex gap-1 items-center">
                <span className="text-accent">●</span>
                <span className="truncate flex-1">{o.name}</span>
                <span className="shrink-0">¥{o.total_cost?.toFixed(0) || 0}</span>
              </div>
            ))}
          </div>
        )}
        {isLinked && it.linked_toy && (
          <div className="text-[10px] text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 w-fit">
            <span>🏠</span>
            <span className="truncate max-w-[120px]">{it.linked_toy.name}</span>
          </div>
        )}
        {referencePrice !== undefined ? (
          <div className="mt-auto">
            <ReferencePriceTag
              price={referencePrice}
              onEdit={onEditReference}
              onClear={onClearReference}
            />
          </div>
        ) : (
          <a
            href={it.detail_url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-accent hover:underline mt-auto"
          >
            考据 ↗
          </a>
        )}
      </div>
      <div className="px-2.5 pb-2.5 flex gap-1.5 border-t border-white/5 pt-1.5">
        {!hasOwned && (
          <button
            type="button"
            onClick={() => onOpenForm('estimate')}
            className="flex-1 text-xs font-semibold py-1.5 rounded bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25"
          >
            🧮 反算
          </button>
        )}
        <div className="relative flex-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setAddMenuOpen(o => !o)}
            className={
              'w-full text-xs font-semibold py-1.5 rounded border ' +
              (isLinked
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25')
            }
          >
            {isLinked ? '🏠 已关联' : (hasOwned ? '➕ 再录' : '➕ 录入')} ▾
          </button>
          {addMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1d27] border border-white/10 rounded-lg shadow-lg z-20 overflow-hidden">
              {it.is_custom ? (
                <button
                  type="button"
                  onClick={() => { setAddMenuOpen(false); handleDelete(); }}
                  disabled={deleting}
                  className="w-full text-left px-3 py-2 text-xs text-red-300 bg-red-500/10 hover:bg-red-500/20 border-b border-red-500/30 disabled:opacity-50"
                >
                  {deleting ? '删除中…' : '🗑️ 删除此自定义玩具'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => { setAddMenuOpen(false); onOpenForm('add'); }}
                className="w-full text-left px-3 py-2 text-xs text-[#d0d4e8] hover:bg-white/5"
              >
                ➕ 新建库存
              </button>
              <button
                type="button"
                onClick={() => { setAddMenuOpen(false); onOpenLinkPicker && onOpenLinkPicker(); }}
                className="w-full text-left px-3 py-2 text-xs text-emerald-300 hover:bg-white/5 border-t border-white/5"
              >
                📦 关联已有库存
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OwnedCard({ it, onZoom, isFav, onToggleFav, onOpenLinkPicker, onUnlink }) {
  const toy = it.linked_toy;
  const [unlinking, setUnlinking] = useState(false);
  const handleUnlink = async () => {
    if (!confirm('确定解除关联？这只会断开 monster 收藏与该 toy 的关联，不会删除玩具本身。')) return;
    setUnlinking(true);
    try { await onUnlink(); }
    finally { setUnlinking(false); }
  };

  // 关联的 toy 已被删除：只显示基本信息 + 解除关联按钮
  if (!toy) {
    return (
      <div className="card overflow-hidden flex flex-col relative ring-2 ring-red-500/40 shadow-lg shadow-red-500/10">
        {it.image_url ? (
          <button type="button" onClick={onZoom} className="bg-black/30 cursor-zoom-in hover:opacity-80 transition-opacity">
            <img src={it.image_url} alt={`${it.character_name_zh || it.character_slug} ${it.source}`}
              className="block w-full h-auto object-contain" style={{ aspectRatio: '100 / 147' }} loading="lazy" />
          </button>
        ) : (
          <div className="w-full bg-black/30 flex items-center justify-center text-[10px] text-[#6b7085]" style={{ aspectRatio: '100 / 147' }}>无图</div>
        )}
        <div className="absolute top-2 right-2 z-10">
          <StarButton active={isFav} onClick={onToggleFav} />
        </div>
        <div className="p-2.5 flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs text-accent">#{it.ref_id.split('-').pop()}</span>
            <span className="text-[10px] text-[#6b7085] truncate">{it.source}</span>
          </div>
          <div className="text-[10px] text-[#a0a4b8] bg-red-500/10 border border-red-500/30 rounded px-1.5 py-1">
            <span className="text-red-300">关联的库存已删除</span>
          </div>
        </div>
        <div className="px-2.5 pb-2.5 flex gap-1.5 border-t border-white/5 pt-1.5">
          <button type="button" onClick={handleUnlink} disabled={unlinking}
            className="flex-1 text-xs font-semibold py-1.5 rounded bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25">
            {unlinking ? '解除中…' : '解除关联'}
          </button>
        </div>
      </div>
    );
  }

  const status = TOY_STATUS_LABELS[toy.status] || toy.status;
  const sourceDisp = sourceLabel(toy.source);
  const profit = toy.profit;
  const profitTone = profit == null ? 'text-[#6b7085]' : profit >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="card overflow-hidden flex flex-col relative ring-2 ring-emerald-500/60 shadow-lg shadow-emerald-500/15">
      {it.image_url ? (
        <button type="button" onClick={onZoom} className="bg-black/30 cursor-zoom-in hover:opacity-80 transition-opacity">
          <img src={it.image_url} alt={`${it.character_name_zh || it.character_slug} ${it.source}`}
            className="block w-full h-auto object-contain" style={{ aspectRatio: '100 / 147' }} loading="lazy" />
        </button>
      ) : (
        <div className="w-full bg-black/30 flex items-center justify-center text-[10px] text-[#6b7085]" style={{ aspectRatio: '100 / 147' }}>无图</div>
      )}
      <div className="absolute top-2 right-2 z-10">
        <StarButton active={isFav} onClick={onToggleFav} />
      </div>
      <div className="p-2.5 flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs text-accent">#{it.ref_id.split('-').pop()}</span>
          <span className="text-[10px] text-[#6b7085] truncate">{it.source}</span>
        </div>

        <div className="text-[10px] text-[#a0a4b8] bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-1 space-y-0.5">
          <div className="font-medium text-emerald-300 truncate" title={toy.name}>{toy.name}</div>
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
            <span className="text-[#d0d4e8]">{status}</span>
            <span>·</span>
            <span>{sourceDisp}</span>
          </div>
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 tabular-nums">
            <span>成本 ¥{(toy.total_cost || 0).toFixed(0)}</span>
            {toy.sell_price > 0 && <span>· 售价 ¥{toy.sell_price}</span>}
            {profit != null && <span className={profitTone}>· 利润 {profit >= 0 ? '+' : ''}¥{profit.toFixed(0)}</span>}
          </div>
        </div>
      </div>
      <div className="px-2.5 pb-2.5 flex gap-1.5 border-t border-white/5 pt-1.5">
        <Link
          to="/warehouse"
          className="flex-1 text-xs font-semibold py-1.5 rounded bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 text-center"
        >
          跳到仓库
        </Link>
        <button
          type="button"
          onClick={onOpenLinkPicker}
          className="flex-1 text-xs font-semibold py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25"
        >
          换关联
        </button>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={unlinking}
          className="text-xs px-2 py-1.5 rounded text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          {unlinking ? '…' : '解除'}
        </button>
      </div>
    </div>
  );
}

function ReferencePriceTag({ price, onEdit, onClear }) {
  if (price != null) {
    return (
      <div className="w-full text-xs py-1.5 px-2 rounded bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center gap-1.5">
        <span className="text-[#a0a4b8]">购入参考价</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-base font-bold text-yellow-300 hover:underline"
          title="点击重新计算"
        >
          ¥{Number(price).toFixed(0)}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-[#6b7085] hover:text-red-400 ml-0.5 leading-none"
          title="清除参考价"
        >
          ×
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full text-xs py-1.5 px-2 rounded bg-white/5 text-[#a0a4b8] border border-white/10 hover:bg-white/10 hover:text-white"
    >
      + 设置购入参考价
    </button>
  );
}

export default function Monster() {
  const [seriesList, setSeriesList] = useState([]);
  const [currentSeries, setCurrentSeries] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [currentCharacter, setCurrentCharacter] = useState(null);
  const [toys, setToys] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formModal, setFormModal] = useState(null); // { type: 'add'|'estimate', item, initialAmount, variant: 'add'|'reference' } | null

  const [viewMode, setViewMode] = useState('all'); // 'all' | 'favorites' | 'owned'
  const [favorites, setFavorites] = useState([]); // [{character_slug, ref_id, note, created_at}]
  const [favToys, setFavToys] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const [linkPicker, setLinkPicker] = useState(null);
  const [deletingChar, setDeletingChar] = useState(false);
  const [catalog, setCatalog] = useState('sofubi'); // 'sofubi' | 'xplus'

  const [showCustomToyForm, setShowCustomToyForm] = useState(false);
  const [showCustomCharForm, setShowCustomCharForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { kind: 'running'|'success'|'error', message: string }

  const setToast = useStore(s => s.setToast);
  const addToy = useStore(s => s.addToy);

  // 同步图鉴：先刷新 DB，再下载缺失/URL 变化的图
  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus({ kind: 'running', message: '正在爬取图鉴数据（约 1 分钟）...' });
    try {
      const r1 = await api.post('/baltan/refresh');
      setSyncStatus({ kind: 'running', message: `数据已刷新 (${r1.count} 条)，正在检查图片...` });
      const r2 = await api.post('/baltan/download-images');
      const errMsg = r2.errors?.length ? `，错误 ${r2.errors.length}` : '';
      setSyncStatus({
        kind: r2.errors?.length ? 'error' : 'success',
        message: `同步完成：新下 ${r2.downloaded} 张，跳过 ${r2.skipped} 张${errMsg}`
      });
      // 数据可能新增了角色/玩具，刷新视图
      await reloadSeries();
      if (currentSeries) await reloadCharacters();
      if (currentCharacter) await loadToys(currentCharacter);
    } catch (e) {
      setSyncStatus({ kind: 'error', message: '同步失败: ' + e.message });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/monster/series');
        setSeriesList(r.series || []);
        if (r.series?.length) setCurrentSeries(r.series[0].series);
      } catch (e) {
        setToast('加载 series 失败: ' + e.message);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/monster/favorites');
        setFavorites(r.favorites || []);
      } catch (e) { /* silent */ }
    })();
  }, []);

  useEffect(() => {
    if (viewMode === 'all') return;
    if (!favorites.length) { setFavToys([]); return; }
    (async () => {
      setFavLoading(true);
      try {
        const r = await api.post('/monster/favorites/toys', {});
        setFavToys(r.toys || []);
      } catch (e) {
        setToast('加载收藏失败: ' + e.message);
      } finally {
        setFavLoading(false);
      }
    })();
  }, [viewMode, favorites]);

  const refreshFavToys = async () => {
    if (viewMode === 'all') return;
    try {
      const r = await api.post('/monster/favorites/toys', {});
      setFavToys(r.toys || []);
    } catch (e) { setToast('刷新收藏失败: ' + e.message); }
  };

  useEffect(() => {
    if (!currentSeries || viewMode !== 'all') return;
    setCurrentCharacter(null);
    setToys([]);
    setFormModal(null);
    (async () => {
      try {
        const r = await api.get(`/monster/characters?series=${encodeURIComponent(currentSeries)}`);
        setCharacters(r.characters || []);
      } catch (e) {
        setToast('加载角色失败: ' + e.message);
      }
    })();
  }, [currentSeries, viewMode]);

  const loadToys = async (c, series) => {
    if (!c) return [];
    setLoading(true);
    const useSeries = series || currentSeries;
    try {
      const r = await api.get(`/baltan/reference?series=${encodeURIComponent(useSeries)}&character=${encodeURIComponent(c.character_slug)}`);
      const items = r.items || [];
      setToys(items);
      return items;
    } catch (e) {
      setToast('加载玩具失败: ' + e.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const selectCharacter = async (c, series) => {
    setCurrentCharacter(c);
    setFormModal(null);
    setShowCustomToyForm(false);
    await loadToys(c, series);
  };

  const backToCharacters = () => {
    setCurrentCharacter(null);
    setToys([]);
    setFormModal(null);
    setShowCustomToyForm(false);
  };

  // 统一返回：角色详情 → 角色列表；收藏/已拥有视图 → 全部视图
  const handleBack = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (currentCharacter) {
      backToCharacters();
    } else if (viewMode !== 'all') {
      setViewMode('all');
    }
  };

  const openFormModal = (type, item, initialAmount = '', variant = 'add') => {
    setFormModal(prev => {
      // 同一玩具同一类型再次点击 → 关闭
      if (prev?.type === type && prev?.item?.ref_id === item.ref_id && prev?.variant === variant) return null;
      return { type, item, initialAmount, variant };
    });
  };

  const closeFormModal = () => setFormModal(null);

  const handleFormAdded = async () => {
    closeFormModal();
    if (viewMode === 'favorites') await refreshFavToys();
    else if (currentCharacter) await loadToys(currentCharacter);
  };

  const handleSaveReference = async (character_slug, ref_id, amount) => {
    try {
      await api.post('/monster/favorites/reference-price', { character_slug, ref_id, price: amount });
      setToast(`已保存参考价 ¥${Number(amount).toFixed(0)}`);
      closeFormModal();
      if (viewMode === 'favorites') await refreshFavToys();
    } catch (e) {
      setToast('保存失败: ' + e.message);
    }
  };

  const clearReferencePrice = async (character_slug, ref_id) => {
    try {
      await api.post('/monster/favorites/reference-price', { character_slug, ref_id, price: null });
      if (viewMode === 'favorites') await refreshFavToys();
    } catch (e) {
      setToast('清除失败: ' + e.message);
    }
  };

  const handleDeleteCustomToy = async (character_slug, ref_id) => {
    await api.del(`/baltan/custom-toy?character_slug=${encodeURIComponent(character_slug)}&ref_id=${encodeURIComponent(ref_id)}`);
    setToast('已删除自定义玩具');
    setToys(prev => prev.filter(t => !(t.character_slug === character_slug && t.ref_id === ref_id)));
    // 重新拉一次角色列表：避免外层卡片还显示着已被删图的 thumbnail_url（导致"图裂"）
    //  - 若该角色下已无 ref，GROUP BY 不再有这一行，角色自动从外层消失
    //  - 若还有 ref，会用新 MIN(image_url) 重算缩略图
    if (currentSeries) {
      try {
        const r = await api.get(`/baltan/characters?series=${encodeURIComponent(currentSeries)}`);
        setCharacters(r.characters || []);
      } catch {}
    }
  };

  const handleDeleteCustomCharacter = async () => {
    if (!currentCharacter) return;
    if (currentCharacter.has_custom !== 1) {
      setToast('该系列含抓取数据，不能整系列删除');
      return;
    }
    const name = currentCharacter.character_name_zh || currentCharacter.character_name_ja || currentCharacter.character_slug;
    if (!confirm(`确定删除整个第三方系列「${name}」？该角色下所有玩具条目（${toys.length} 件）会一并删除。如有关联库存需先解除。`)) return;
    setDeletingChar(true);
    try {
      const r = await api.del(`/baltan/custom-character?character_slug=${encodeURIComponent(currentCharacter.character_slug)}`);
      setToast(`已删除系列「${name}」(${r.deleted_refs} 件)`);
      // 清状态：返回外层
      setCurrentCharacter(null);
      setToys([]);
      setShowCustomToyForm(false);
      setShowCustomCharForm(false);
      // 重拉外层角色列表
      if (currentSeries) {
        try {
          const cr = await api.get(`/baltan/characters?series=${encodeURIComponent(currentSeries)}`);
          setCharacters(cr.characters || []);
        } catch {}
      }
    } catch (e) {
      setToast('删除失败: ' + e.message);
    } finally {
      setDeletingChar(false);
    }
  };

  // 角色卡仅作"该角色下有单品已收藏"的视觉提示（黄色 ring），不参与 toggle
  const isCharFav = (slug) => favorites.some(f => f.character_slug === slug);
  const isToyFav = (slug, refId) => favorites.some(f => f.character_slug === slug && f.ref_id === refId);

  const toggleFav = async (character_slug, ref_id) => {
    const active = isToyFav(character_slug, ref_id);

    // optimistic update
    setFavorites(prev => {
      if (!active) {
        return [{ character_slug, ref_id, note: null, created_at: new Date().toISOString() }, ...prev];
      }
      return prev.filter(f => !(f.character_slug === character_slug && f.ref_id === ref_id));
    });

    try {
      if (active) {
        await api.del(`/monster/favorites?character_slug=${encodeURIComponent(character_slug)}&ref_id=${encodeURIComponent(ref_id)}`);
      } else {
        await api.post('/monster/favorites', { character_slug, ref_id });
      }
    } catch (e) {
      setToast('操作失败: ' + e.message);
      // 回滚
      setFavorites(prev => {
        if (!active) {
          return prev.filter(f => !(f.character_slug === character_slug && f.ref_id === ref_id));
        }
        return [...prev, { character_slug, ref_id, note: null, created_at: new Date().toISOString() }];
      });
    }
  };

  const reloadCharacters = async () => {
    if (!currentSeries) return;
    try {
      const r = await api.get(`/monster/characters?series=${encodeURIComponent(currentSeries)}`);
      setCharacters(r.characters || []);
    } catch (e) { setToast('刷新角色失败: ' + e.message); }
  };

  const reloadSeries = async () => {
    try {
      const r = await api.get('/monster/series');
      setSeriesList(r.series || []);
    } catch (e) { setToast('刷新 series 失败: ' + e.message); }
  };

  const onCustomCharAdded = async (newSeries) => {
    await reloadSeries();
    if (newSeries) {
      setCurrentSeries(newSeries);
      setViewMode('all');
    }
  };

  const onCustomToyAdded = async () => {
    if (currentCharacter) await loadToys(currentCharacter);
    await reloadCharacters();
  };

  const favCount = favorites.length;
  const ownedCount = favorites.filter(f => f.linked_toy_id).length;

  if (catalog === 'xplus') {
    return (
      <div style={{ background: '#FFFFCC', margin: '-1.5rem -1rem', padding: '1rem' }}>
        <div className="flex items-center gap-3 mb-3 px-2">
          <span style={{ color: '#990000', fontWeight: 'bold', fontSize: 14 }}>大玩具博物館</span>
          <div className="flex rounded border overflow-hidden" style={{ borderColor: '#CC6600' }}>
            <button type="button" onClick={() => setCatalog('sofubi')}
              className="px-3 py-1 text-xs transition-colors"
              style={{ background: 'transparent', color: '#CC6600', border: 'none' }}>sofubi</button>
            <button type="button" onClick={() => setCatalog('xplus')}
              className="px-3 py-1 text-xs font-bold transition-colors"
              style={{ background: '#CC6600', color: '#fff', border: 'none' }}>XPLUS</button>
          </div>
        </div>
        <Xplus />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_2px_rgba(245,158,11,0.6)]" />
            怪兽图鉴
          </h2>
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <button type="button" onClick={() => setCatalog('sofubi')}
              className="px-3 py-1 text-xs rounded-md bg-amber-500 text-[#0f1117] font-semibold transition-colors">sofubi</button>
            <button type="button" onClick={() => setCatalog('xplus')}
              className="px-3 py-1 text-xs rounded-md text-[#6b7085] hover:text-white transition-colors">XPLUS</button>
          </div>
        </div>
        <p className="text-xs text-[#6b7085]">
          来源：<a href="https://ultrakaijyu.com/" target="_blank" rel="noreferrer" className="text-accent hover:underline">ウルトラ怪獣.com 資料室</a>
        </p>
      </div>

      {/* 醒目返回按钮 - 任何子界面（角色详情 / 收藏 / 已拥有）都显示 */}
      {(currentCharacter || viewMode !== 'all') && (
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-[#0f1117] border-2 border-accent/80 hover:bg-accent/90 text-sm font-bold transition-all shadow-md shadow-accent/30 active:scale-95"
        >
          <span className="text-lg leading-none">←</span>
          返回怪兽图鉴
        </button>
      )}

      {/* series tabs + 收藏切换 + 第三方角色入口 */}
      {currentCharacter === null && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            {viewMode === 'all' && seriesList.map(s => (
              <SeriesTab
                key={s.series}
                s={s}
                active={s.series === currentSeries}
                onClick={() => setCurrentSeries(s.series)}
              />
            ))}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'favorites' ? 'all' : 'favorites')}
              className={
                'text-xs px-3 py-1.5 rounded-full transition-all font-medium ' +
                (viewMode === 'favorites'
                  ? 'bg-yellow-400 text-[#0f1117] font-semibold shadow-md shadow-yellow-500/30'
                  : 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/20')
              }
            >
              {viewMode === 'favorites' ? '★ 收藏视图' : `☆ 收藏 (${favCount})`}
            </button>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'owned' ? 'all' : 'owned')}
              className={
                'text-xs px-3 py-1.5 rounded-full transition-all font-medium ' +
                (viewMode === 'owned'
                  ? 'bg-emerald-500 text-[#0f1117] font-semibold shadow-md shadow-emerald-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/20')
              }
            >
              {viewMode === 'owned' ? '🏠 已拥有视图' : `🏠 已拥有 (${ownedCount})`}
            </button>
            {viewMode === 'all' && (
              <button
                type="button"
                onClick={() => setShowCustomCharForm(o => !o)}
                className="text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
              >
                + 第三方角色
              </button>
            )}
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className={
                'text-xs px-3 py-1.5 rounded-full transition-colors border ' +
                (syncing
                  ? 'bg-white/5 text-[#6b7085] border-white/10 cursor-wait'
                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/20')
              }
              title="从 ultrakaijyu.com 重新爬数据并下载缺失/变更的图片"
            >
              {syncing ? '⟳ 同步中…' : '🔄 同步图鉴'}
            </button>
          </div>
          {syncStatus && (
            <div
              className={
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ' +
                (syncStatus.kind === 'running'
                  ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/40'
                  : syncStatus.kind === 'success'
                  ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40'
                  : 'bg-red-500/10 text-red-200 border-red-500/40')
              }
            >
              {syncStatus.kind === 'running' && (
                <span className="inline-block w-3 h-3 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
              )}
              {syncStatus.kind === 'success' && <span className="text-emerald-300">✓</span>}
              {syncStatus.kind === 'error' && <span className="text-red-300">✗</span>}
              <span className="flex-1">{syncStatus.message}</span>
              {syncStatus.kind !== 'running' && (
                <button
                  type="button"
                  onClick={() => setSyncStatus(null)}
                  className="text-current/60 hover:text-current text-base leading-none px-1"
                  title="关闭"
                >
                  ×
                </button>
              )}
            </div>
          )}
          {showCustomCharForm && (
            <CustomCharacterForm
              defaultSeries={currentSeries}
              onClose={() => setShowCustomCharForm(false)}
              onAdded={onCustomCharAdded}
              setToast={setToast}
            />
          )}
        </div>
      )}

      {/* 面包屑（角色页）- 仅显示当前位置，返回按钮已提到顶部 */}
      {currentCharacter && (
        <div className="flex items-center gap-2 text-xs text-[#a0a4b8]">
          <span className="text-[#6b7085]">{SERIES_LABELS[currentSeries] || currentSeries}</span>
          <span className="text-[#6b7085]">/</span>
          <span className="font-medium">
            {currentCharacter.character_name_zh || currentCharacter.character_name_ja || currentCharacter.character_slug}
          </span>
          <span className="text-[#6b7085]">· {toys.length} 件</span>
        </div>
      )}

      {/* 角色网格（全部模式） */}
      {viewMode === 'all' && currentCharacter === null && characters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {characters.map(c => (
            <CharacterCard
              key={c.character_slug}
              c={c}
              onClick={() => selectCharacter(c)}
              isFav={isCharFav(c.character_slug)}
            />
          ))}
        </div>
      )}

      {/* 玩具网格（收藏/已拥有模式） */}
      {(viewMode === 'favorites' || viewMode === 'owned') && currentCharacter === null && (
        favLoading ? (
          <div className="text-xs text-[#6b7085]">加载中…</div>
        ) : (() => {
          const list = viewMode === 'owned'
            ? favToys.filter(t => t.linked_toy_id)
            : favToys;
          if (list.length === 0) {
            return (
              <div className="text-xs text-[#6b7085]">
                {viewMode === 'owned'
                  ? '还没有已拥有的收藏。点收藏卡上的「➕ 录入 ▾ → 📦 关联已有库存」就能搬过来。'
                  : '还没有收藏。进入角色页后，点玩具卡右上角的 ☆ 收藏喜欢的单品。'}
              </div>
            );
          }
          // 已拥有统计
          let ownedStats = null;
          if (viewMode === 'owned') {
            const ownedToys = list.map(it => it.linked_toy).filter(Boolean);
            const totalValue = ownedToys.reduce((s, t) => s + (t.total_cost || 0), 0);
            const catMap = {};
            ownedToys.forEach(t => { const cat = t.category || '未分类'; catMap[cat] = (catMap[cat] || 0) + 1; });
            const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
            ownedStats = (
              <div className="card bg-black/20 border border-orange-500/20 p-3 space-y-2">
                <div className="flex items-center gap-4 text-xs flex-wrap">
                  <span>自留 <span className="text-white font-bold">{ownedToys.length}</span> 件</span>
                  <span>总价值 <span className="text-accent font-bold">¥{totalValue.toFixed(0)}</span></span>
                  {ownedToys.length > 0 && <span>均价 <span className="text-white font-bold">¥{(totalValue / ownedToys.length).toFixed(0)}</span></span>}
                </div>
                <div className="flex gap-1.5 text-[10px] flex-wrap">
                  {cats.map(([cat, count]) => (
                    <span key={cat} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {cat} <span className="text-[#6b7085]">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <>
              {ownedStats}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {list.map(it => {
                if (viewMode === 'owned' && it.linked_toy_id) {
                  return (
                    <OwnedCard
                      key={it.ref_id}
                      it={it}
                      onZoom={() => setViewing(it)}
                      isFav={isToyFav(it.character_slug, it.ref_id)}
                      onToggleFav={() => toggleFav(it.character_slug, it.ref_id)}
                      onOpenLinkPicker={() => setLinkPicker({ character_slug: it.character_slug, ref_id: it.ref_id, linked_toy_id: it.linked_toy_id })}
                      onUnlink={async () => {
                        try {
                          await api.post('/monster/favorites/unlink-toy', { character_slug: it.character_slug, ref_id: it.ref_id });
                          setToast('已解除关联');
                          refreshFavToys();
                        } catch (e) { setToast('解除失败: ' + e.message); }
                      }}
                    />
                  );
                }
                return (
                  <ToyCard
                    key={it.ref_id}
                    it={it}
                    onZoom={() => setViewing(it)}
                    onOpenForm={(type) => openFormModal(type, it, '', type === 'estimate' ? 'reference' : 'add')}
                    onOpenLinkPicker={() => setLinkPicker({ character_slug: it.character_slug, ref_id: it.ref_id, linked_toy_id: it.linked_toy_id })}
                    addToy={addToy}
                    isFav={isToyFav(it.character_slug, it.ref_id)}
                    onToggleFav={() => toggleFav(it.character_slug, it.ref_id)}
                    referencePrice={it.reference_price}
                    onEditReference={() => openFormModal('estimate', it, '', 'reference')}
                    onClearReference={() => clearReferencePrice(it.character_slug, it.ref_id)}
                    onDelete={() => handleDeleteCustomToy(it.character_slug, it.ref_id)}
                    setToast={setToast}
                  />
                );
              })}
            </div>
            </>
          );
        })()
      )}

      {linkPicker && (
        <LinkPickerModal
          character_slug={linkPicker.character_slug}
          ref_id={linkPicker.ref_id}
          currentLinkedId={linkPicker.linked_toy_id}
          onLinked={() => { setLinkPicker(null); refreshFavToys(); }}
          onUnlinked={() => { setLinkPicker(null); refreshFavToys(); }}
          onClose={() => setLinkPicker(null)}
        />
      )}

      {/* 玩具列表（角色页） */}
      {currentCharacter && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-[#6b7085]">
              反算购入价 · 录入库存
            </div>
            <div className="flex items-center gap-2">
              {currentCharacter.has_custom ? (
                <button
                  type="button"
                  onClick={handleDeleteCustomCharacter}
                  disabled={deletingChar}
                  className="text-xs px-3 py-1.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 disabled:opacity-50"
                >
                  {deletingChar ? '删除中…' : '🗑️ 删除系列'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowCustomToyForm(o => !o)}
                className="text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
              >
                {showCustomToyForm ? '收起' : '+ 第三方玩具'}
              </button>
            </div>
          </div>
          {showCustomToyForm && (
            <CustomToyForm
              defaultCharacter={currentCharacter}
              onClose={() => setShowCustomToyForm(false)}
              onAdded={onCustomToyAdded}
              setToast={setToast}
            />
          )}
          {loading ? (
            <div className="text-xs text-[#6b7085]">加载中…</div>
          ) : toys.length === 0 ? (
            <div className="text-xs text-[#6b7085]">暂无数据</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {toys.map(it => (
                <ToyCard
                  key={it.ref_id}
                  it={it}
                  onZoom={() => setViewing(it)}
                  onOpenForm={(type) => openFormModal(type, it)}
                  addToy={addToy}
                  isFav={isToyFav(it.character_slug, it.ref_id)}
                  onToggleFav={() => toggleFav(it.character_slug, it.ref_id)}
                  onDelete={() => handleDeleteCustomToy(it.character_slug, it.ref_id)}
                  setToast={setToast}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {viewing && (
        <ImageModal
          src={viewing.image_big_url || viewing.image_url}
          alt={viewing.source
            ? `${viewing.character_name_zh || viewing.character_name_ja || viewing.character_slug} ${viewing.source}`
            : (viewing.character_name_zh || viewing.character_name_ja || viewing.character_slug)
          }
          detailUrl={viewing.detail_url}
          onClose={() => setViewing(null)}
        />
      )}

      {formModal && (
        <ToyFormModal
          item={formModal.item}
          type={formModal.type}
          initialAmount={formModal.initialAmount}
          onClose={closeFormModal}
          onAdded={handleFormAdded}
          onUseForAdd={formModal.variant === 'add'
            ? (amount) => openFormModal('add', formModal.item, amount, 'add')
            : undefined}
          onSaveAsReference={formModal.variant === 'reference'
            ? (amount) => handleSaveReference(formModal.item.character_slug, formModal.item.ref_id, amount)
            : undefined}
          addToy={addToy}
        />
      )}
    </div>
  );
}
