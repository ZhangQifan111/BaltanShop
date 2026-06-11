import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import useStore from '../stores/useStore';
import ImageModal from '../components/ImageModal';
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
const SOURCE_DEFAULTS = {
  direct: { stage2_handling: 10, stage2_domestic_ship: 90, stage3_intl_ship: 70, logistics_fee: 10, box_fee: 5, packing_fee: 5 },
  proxy:  { stage2_handling: 0,  stage2_domestic_ship: 0,  stage3_intl_ship: 70, logistics_fee: 10, box_fee: 5, packing_fee: 5 },
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

  const filtered = toys
    .filter(t => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.name?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q);
    })
    .slice(0, 100);

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
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">关联已有库存</h3>
          {currentLinkedId && (
            <button
              type="button"
              onClick={handleUnlink}
              disabled={loading === 'unlink'}
              className="text-xs text-red-300 hover:underline disabled:opacity-50"
            >
              {loading === 'unlink' ? '解除中…' : '解除当前关联'}
            </button>
          )}
        </div>
        <p className="text-[10px] text-[#6b7085] -mt-1">挑一件已有的 toys 记录关联到这个 ref。选了之后该收藏会自动从「收藏」视图搬到「已拥有」视图。</p>

        <input
          className="input text-sm"
          placeholder="🔍 搜索商品名称 / 品类…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        <div className="space-y-1 max-h-96 overflow-y-auto">
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
                  'w-full text-left px-3 py-2 rounded-lg border text-xs flex justify-between items-center gap-2 transition-colors ' +
                  (isCurrent
                    ? 'border-emerald-500/50 bg-emerald-500/10 cursor-default'
                    : 'border-white/5 hover:bg-white/5 cursor-pointer')
                }
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate">{toy.name}</div>
                  <div className="text-[10px] text-[#6b7085] mt-0.5">
                    {status} · {toy.source === 'direct' ? '直购' : toy.source === 'proxy' ? '代购' : toy.source === 'domestic' ? '国内' : toy.source === 'secondhand' ? '二手' : toy.source} · ¥{(toy.total_cost || 0).toFixed(0)}
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

  const onSourceChange = (s) => {
    setForm(f => ({ ...f, source: s, ...SOURCE_DEFAULTS[s] }));
  };

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
          <select
            value={form.source}
            onChange={e => onSourceChange(e.target.value)}
            className="input text-xs w-full"
          >
            <option value="direct">直购</option>
            <option value="proxy">代购</option>
          </select>
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
              type="number"
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
              type="number"
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
              type="number"
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
              type="number"
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
              type="number"
              value={form.logistics_fee}
              onChange={e => update('logistics_fee', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">纸箱费 (¥)</span>
            <input
              type="number"
              value={form.box_fee}
              onChange={e => update('box_fee', e.target.value)}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <span className="text-[9px] text-[#6b7085] block mb-0.5">打包费 (¥)</span>
            <input
              type="number"
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
        <span className="text-[9px] text-[#6b7085] block mb-0.5">图片 URL（http(s) 会被下载到本地）</span>
        <input type="text" value={form.image_url} onChange={e => update('image_url', e.target.value)}
          placeholder="https://…  （留空则无图）"
          className="input text-xs w-full" />
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
          <span className="text-[9px] text-[#6b7085] block mb-0.5">图片 URL</span>
          <input type="text" value={form.image_url} onChange={e => update('image_url', e.target.value)}
            placeholder="https://…（留空则无图）"
            className="input text-xs w-full" />
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

function ToyCard({ it, onZoom, onOpenForm, addToy, isFav, onToggleFav, referencePrice, onEditReference, onClearReference, onOpenLinkPicker }) {
  const hasOwned = it.owned && it.owned.length > 0;
  const isLinked = !!it.linked_toy_id;
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
  const status = TOY_STATUS_LABELS[toy.status] || toy.status;
  const sourceLabel = toy.source === 'direct' ? '直购' : toy.source === 'proxy' ? '代购' : toy.source === 'domestic' ? '国内' : toy.source === 'secondhand' ? '二手' : toy.source;
  const profit = toy.profit;
  const profitTone = profit == null ? 'text-[#6b7085]' : profit >= 0 ? 'text-green-400' : 'text-red-400';
  const [unlinking, setUnlinking] = useState(false);
  const handleUnlink = async () => {
    if (!confirm('确定解除关联？这只会断开 monster 收藏与该 toy 的关联，不会删除玩具本身。')) return;
    setUnlinking(true);
    try { await onUnlink(); }
    finally { setUnlinking(false); }
  };

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
            <span>{sourceLabel}</span>
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
  const [linkPicker, setLinkPicker] = useState(null); // {character_slug, ref_id, linked_toy_id} | null

  const [showCustomToyForm, setShowCustomToyForm] = useState(false);
  const [showCustomCharForm, setShowCustomCharForm] = useState(false);

  const setToast = useStore(s => s.setToast);
  const addToy = useStore(s => s.addToy);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_2px_rgba(245,158,11,0.6)]" />
          怪兽图鉴
        </h2>
        <p className="text-xs text-[#6b7085]">
          来源：<a href="https://ultrakaijyu.com/" target="_blank" rel="noreferrer" className="text-accent hover:underline">ウルトラ怪獣.com 資料室</a>
        </p>
      </div>

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
          </div>
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

      {/* 面包屑（角色页） */}
      {currentCharacter && (
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={backToCharacters}
            className="text-accent hover:underline"
          >
            ← 返回 {SERIES_LABELS[currentSeries] || currentSeries}
          </button>
          <span className="text-[#6b7085]">/</span>
          <span className="text-[#a0a4b8] font-medium">
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
          const list = viewMode === 'favorites'
            ? favToys.filter(t => !t.linked_toy_id)
            : favToys.filter(t => t.linked_toy_id);
          if (list.length === 0) {
            return (
              <div className="text-xs text-[#6b7085]">
                {viewMode === 'favorites'
                  ? '还没有收藏。进入角色页后，点玩具卡右上角的 ☆ 收藏喜欢的单品。'
                  : '还没有已拥有的收藏。点收藏卡上的「➕ 录入 ▾ → 📦 关联已有库存」就能搬过来。'}
              </div>
            );
          }
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {list.map(it => {
                if (viewMode === 'owned') {
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
                  />
                );
              })}
            </div>
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
            <button
              type="button"
              onClick={() => setShowCustomToyForm(o => !o)}
              className="text-xs px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
            >
              {showCustomToyForm ? '收起' : '+ 第三方玩具'}
            </button>
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
