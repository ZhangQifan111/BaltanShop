import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import useStore from '../stores/useStore';
import ImageModal from '../components/ImageModal';

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
};

const DEFAULT_FEES = {
  source: 'direct',
  sell_price: '1000',
  profit_rate: '20',
  handling_fee: '10',
  japan_domestic_shipping: '90',
  intl_shipping: '70',
  logistics_fee: '10',
  box_fee: '5',
  packing_fee: '5',
  huabei: '0',
  refund_amount: '0',
};

const SOURCE_DEFAULTS = {
  direct: { stage2_handling: 10, stage2_domestic_ship: 90, stage3_intl_ship: 70, logistics_fee: 10, box_fee: 5, packing_fee: 5 },
  proxy:  { stage2_handling: 0,  stage2_domestic_ship: 0,  stage3_intl_ship: 70, logistics_fee: 10, box_fee: 5, packing_fee: 5 },
};

const num = (v) => (v === '' || v === null || v === undefined) ? 0 : Number(v);

function Field({ label, v, onChange }) {
  return (
    <label className="block">
      <span className="text-[9px] text-[#6b7085] block mb-0.5">{label}</span>
      <input
        type="number"
        value={v}
        onChange={e => onChange(e.target.value)}
        className="input text-xs w-full"
      />
    </label>
  );
}

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

function CharacterCard({ c, onClick }) {
  const initial = (c.character_slug || '?').charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="card overflow-hidden text-left hover:ring-1 hover:ring-accent/40 transition-shadow flex flex-col"
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
          {c.toy_count} 件
        </div>
      </div>
    </button>
  );
}

function EstimateForm({ item, onClose }) {
  const [form, setForm] = useState({ ...DEFAULT_FEES });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const calc = async () => {
    setLoading(true);
    try {
      const body = {
        source: form.source,
        sell_price: num(form.sell_price),
        profit_rate: num(form.profit_rate) / 100,
        handling_fee: num(form.handling_fee),
        japan_domestic_shipping: num(form.japan_domestic_shipping),
        intl_shipping: num(form.intl_shipping),
        logistics_fee: num(form.logistics_fee),
        box_fee: num(form.box_fee),
        packing_fee: num(form.packing_fee),
        huabei: num(form.huabei),
        refund_amount: num(form.refund_amount),
      };
      const r = await api.post('/toys/estimate', body);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg bg-black/30 border border-white/10 space-y-2 text-xs">
      <div className="grid grid-cols-3 gap-2">
        <Field label="目标售价" v={form.sell_price} onChange={v => update('sell_price', v)} />
        <Field label="利润率%" v={form.profit_rate} onChange={v => update('profit_rate', v)} />
        <Field label="国际运费" v={form.intl_shipping} onChange={v => update('intl_shipping', v)} />
      </div>
      <div className="text-[9px] text-[#6b7085]">
        费用默认: 手续费 10 + 日本境内 90 + 物流 10 + box 5 + pack 5 (直购)
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={calc}
          disabled={loading}
          className="px-3 py-1.5 rounded bg-accent text-[#0f1117] text-xs font-medium disabled:opacity-50"
        >
          {loading ? '计算中…' : '反算购入价'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-white/5 text-[#a0a4b8] text-xs"
        >
          收起
        </button>
      </div>
      {result && !result.error && (
        <div className={`p-2 rounded ${result.feasible ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <div className="text-[10px] text-[#6b7085]">建议购入价上限</div>
          <div className="text-lg font-bold text-accent">¥{result.base_price?.toFixed(0)}</div>
          {!result.feasible && <div className="text-[10px] text-red-400 mt-1">{result.warning}</div>}
        </div>
      )}
      {result?.error && (
        <div className="text-red-400 text-[10px]">{result.error}</div>
      )}
    </div>
  );
}

function AddForm({ item, onClose, onAdded, addToy }) {
  const nn = item.ref_id.split('-').pop();
  const displayName = item.character_name_zh || item.character_slug || '';
  const defaultName = `${displayName} #${nn} ${item.source}`;
  const [form, setForm] = useState({
    name: defaultName,
    source: 'direct',
    status: 'stock',
    stage1_amount: '',
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

function ToyCard({ it, onZoom, panel, openPanel, addToy, onAdded }) {
  const key = it.ref_id;
  const hasOwned = it.owned && it.owned.length > 0;
  const activePanel = panel[key];

  return (
    <div className="card overflow-hidden flex flex-col">
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
      <div className="p-2.5 flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-accent">#{it.ref_id.split('-').pop()}</span>
          <span className="text-[10px] text-[#6b7085] truncate">{it.source}</span>
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
        <a
          href={it.detail_url}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-accent hover:underline mt-auto"
        >
          考据 ↗
        </a>
      </div>
      <div className="px-2.5 pb-2.5 flex gap-1.5 border-t border-white/5 pt-1.5">
        {!hasOwned && (
          <button
            type="button"
            onClick={() => openPanel(key, 'estimate')}
            className={
              'flex-1 text-xs font-semibold py-1.5 rounded ' +
              (activePanel === 'estimate'
                ? 'bg-accent text-[#0f1117]'
                : 'bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25')
            }
          >
            {activePanel === 'estimate' ? '收起' : '🧮 反算'}
          </button>
        )}
        <button
          type="button"
          onClick={() => openPanel(key, 'add')}
          className={
            'flex-1 text-xs font-semibold py-1.5 rounded ' +
            (activePanel === 'add'
              ? 'bg-emerald-500 text-[#0f1117]'
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25')
          }
        >
          {activePanel === 'add' ? '收起' : hasOwned ? '➕ 再录' : '➕ 录入'}
        </button>
      </div>
      {activePanel === 'estimate' && !hasOwned && (
        <div className="border-t border-white/5 px-2.5 pb-2.5">
          <EstimateForm item={it} onClose={() => openPanel(key, null)} />
        </div>
      )}
      {activePanel === 'add' && (
        <div className="border-t border-white/5 px-2.5 pb-2.5">
          <AddForm item={it} onClose={() => openPanel(key, null)} onAdded={onAdded} addToy={addToy} />
        </div>
      )}
    </div>
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
  const [panel, setPanel] = useState({});
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
    if (!currentSeries) return;
    setCurrentCharacter(null);
    setToys([]);
    setPanel({});
    (async () => {
      try {
        const r = await api.get(`/monster/characters?series=${encodeURIComponent(currentSeries)}`);
        setCharacters(r.characters || []);
      } catch (e) {
        setToast('加载角色失败: ' + e.message);
      }
    })();
  }, [currentSeries]);

  const loadToys = async (c) => {
    if (!c) return [];
    setLoading(true);
    try {
      const r = await api.get(`/baltan/reference?series=${encodeURIComponent(currentSeries)}&character=${encodeURIComponent(c.character_slug)}`);
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

  const selectCharacter = async (c) => {
    setCurrentCharacter(c);
    setPanel({});
    await loadToys(c);
  };

  const backToCharacters = () => {
    setCurrentCharacter(null);
    setToys([]);
    setPanel({});
  };

  const openPanel = (key, p) => setPanel(o => ({ ...o, [key]: o[key] === p ? null : p }));

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

      {currentCharacter === null && (
        <div className="flex flex-wrap gap-2">
          {seriesList.map(s => (
            <SeriesTab
              key={s.series}
              s={s}
              active={s.series === currentSeries}
              onClick={() => setCurrentSeries(s.series)}
            />
          ))}
        </div>
      )}

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

      {currentCharacter === null && characters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {characters.map(c => (
            <CharacterCard
              key={c.character_slug}
              c={c}
              onClick={() => selectCharacter(c)}
            />
          ))}
        </div>
      )}

      {currentCharacter && (
        loading ? (
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
                panel={panel}
                openPanel={openPanel}
                addToy={addToy}
                onAdded={() => loadToys(currentCharacter)}
              />
            ))}
          </div>
        )
      )}

      {viewing && (
        <ImageModal
          src={viewing.image_big_url || viewing.image_url}
          alt={`${viewing.character_name_zh || viewing.character_name_ja || viewing.character_slug} ${viewing.source}`}
          detailUrl={viewing.detail_url}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
