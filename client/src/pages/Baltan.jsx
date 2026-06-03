import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import useStore from '../stores/useStore';

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

const num = (v) => (v === '' || v === null || v === undefined) ? 0 : Number(v);

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

// 切换进货渠道时套用的默认值（与 /procurement 入库流程对齐）
const SOURCE_DEFAULTS = {
  direct: {
    stage2_handling: 10,
    stage2_domestic_ship: 90,
    stage3_intl_ship: 70,
    logistics_fee: 10,
    box_fee: 5,
    packing_fee: 5,
  },
  proxy: {
    stage2_handling: 0,
    stage2_domestic_ship: 0,
    stage3_intl_ship: 70,
    logistics_fee: 10,
    box_fee: 5,
    packing_fee: 5,
  },
};

function AddForm({ item, onClose, onAdded, addToy }) {
  const gen = item.generation;
  const defaultName = gen === 1
    ? `バルタン星人${item.ref_id} ${item.source}`
    : `バルタン星人（二代目）${item.ref_id} ${item.source}`;
  const refId = `${gen}-${item.ref_id}`;
  const [form, setForm] = useState({
    name: defaultName,
    source: 'direct',
    status: 'stock',
    stage1_amount: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: '',
    baltan_ref_id: refId,
    ...SOURCE_DEFAULTS.direct,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // 切换渠道：重置阶段费用默认值，但保留用户已填的 stage1_amount / name / status / date / notes
  const onSourceChange = (s) => {
    setForm(f => ({
      ...f,
      source: s,
      ...SOURCE_DEFAULTS[s],
    }));
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
      // 海关税 = stage1_amount × 0.13 (与 /procurement 一致)
      body.stage3_tax = Math.round(body.stage1_amount * 0.13 * 100) / 100;
      // 汇总阶段金额
      body.stage2_amount = body.stage2_handling + body.stage2_domestic_ship;
      body.stage3_amount = body.stage3_intl_ship + body.stage3_tax;
      // 阶段日期默认同购入日期
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
  // 实时展示海关税（只读）
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

      {/* ① 买货成本 */}
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

      {/* ② 国内中转 */}
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

      {/* ③ 国际段 */}
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

      {/* 仓储发货 */}
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

      {/* 备注 */}
      <div>
        <span className="text-[9px] text-[#6b7085] block mb-0.5">备注</span>
        <input
          type="text"
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          className="input text-xs w-full"
        />
      </div>

      {/* 总成本预览 */}
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

export default function Baltan() {
  const [data, setData] = useState(null);
  const [panel, setPanel] = useState({}); // key => 'estimate' | 'add' | null
  const setToast = useStore(s => s.setToast);
  const addToy = useStore(s => s.addToy);

  const load = async () => {
    try {
      const d = await api.get('/baltan/reference');
      setData(d);
    } catch (e) {
      setToast('加载失败: ' + e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const openPanel = (key, p) => setPanel(o => ({ ...o, [key]: o[key] === p ? null : p }));
  const closePanel = (key) => setPanel(o => ({ ...o, [key]: null }));

  if (!data) return <div className="text-xs text-[#6b7085]">加载中…</div>;

  const gen1 = data.items.filter(i => i.generation === 1);
  const gen2 = data.items.filter(i => i.generation === 2);

  const renderItem = (it) => {
    const key = `${it.generation}-${it.ref_id}`;
    const hasOwned = it.owned.length > 0;
    const activePanel = panel[key]; // 'estimate' | 'add' | undefined/null
    return (
      <div key={key} className="card overflow-hidden flex flex-col relative">
        {/* 怪兽剪影水印 */}
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute right-1 bottom-1 w-12 h-12 opacity-[0.05] text-red-500"
          fill="currentColor"
        >
          <path d="M 30 35 Q 30 15, 50 15 Q 70 15, 70 35 L 75 40 L 70 45 L 70 70 Q 70 80, 60 80 L 40 80 Q 30 80, 30 70 L 30 45 L 25 40 Z" />
          <ellipse cx="40" cy="40" rx="4" ry="6" fill="#0f1117" />
          <ellipse cx="60" cy="40" rx="4" ry="6" fill="#0f1117" />
        </svg>
        <div className="flex">
          {it.image_url && (
            <a href={it.image_big_url || it.image_url} target="_blank" rel="noreferrer" className="shrink-0 bg-black/30">
              <img
                src={it.image_url}
                alt={`#${it.ref_id} ${it.source}`}
                className="block w-32 h-auto object-contain"
                style={{ aspectRatio: '100 / 147' }}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </a>
          )}
          <div className="p-3 flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-accent shrink-0">#{it.ref_id}</span>
              <span className="text-base text-[#a0a4b8] truncate">{it.source}</span>
            </div>
            {hasOwned ? (
              <div className="space-y-1 flex-1 overflow-hidden">
                {it.owned.map(o => (
                  <div key={o.id} className="text-sm text-[#a0a4b8] flex gap-1.5 items-center">
                    <span className="text-accent">●</span>
                    <span className="truncate flex-1">{o.name}</span>
                    <span className="shrink-0">¥{o.total_cost?.toFixed(0) || 0}</span>
                  </div>
                ))}
              </div>
            ) : it.fuzzy_count > 0 ? (
              <div className="text-xs text-[#6b7085] flex-1">
                未精确绑定 · 名字含「巴坦」的玩具 {it.fuzzy_count} 件
              </div>
            ) : (
              <div className="text-sm text-[#6b7085] flex-1">未收录</div>
            )}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5">
              <a
                href={it.detail_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent hover:underline"
              >
                考据 ↗
              </a>
              <div className="flex gap-1.5">
                {!hasOwned && (
                  <button
                    type="button"
                    onClick={() => openPanel(key, 'estimate')}
                    className={
                      activePanel === 'estimate'
                        ? 'text-sm font-semibold px-3 py-1.5 rounded bg-accent text-[#0f1117]'
                        : 'text-sm font-medium px-3 py-1.5 rounded bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25'
                    }
                  >
                    {activePanel === 'estimate' ? '收起' : '🧮 反算'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openPanel(key, 'add')}
                  className={
                    activePanel === 'add'
                      ? 'text-sm font-semibold px-3 py-1.5 rounded bg-emerald-500 text-[#0f1117]'
                      : 'text-sm font-medium px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
                  }
                >
                  {activePanel === 'add' ? '收起' : hasOwned ? '➕ 再录一只' : '➕ 录入'}
                </button>
              </div>
            </div>
          </div>
        </div>
        {activePanel === 'estimate' && !hasOwned && (
          <div className="border-t border-white/5">
            <EstimateForm item={it} onClose={() => closePanel(key)} />
          </div>
        )}
        {activePanel === 'add' && (
          <div className="border-t border-white/5">
            <AddForm item={it} onClose={() => closePanel(key)} onAdded={load} addToy={addToy} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative space-y-6">
      {/* 背景：深紫黑 + 顶部蓝光晕 + 底部红光晕 + 4 层星点 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 30% 0%, rgba(99, 102, 241, 0.18) 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at 85% 100%, rgba(239, 68, 68, 0.14) 0%, transparent 55%),
            radial-gradient(1.5px 1.5px at 25px 25px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 75px 75px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.2px 1.2px at 125px 30px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 175px 110px, rgba(255,255,255,0.4), transparent),
            #0a0612
          `,
          backgroundSize: '100% 100%, 100% 100%, 100px 100px, 100px 100px, 150px 150px, 120px 120px, 100% 100%',
        }}
      />
      <div className="relative z-10 space-y-6">
      <div>
        {/* 顶部斯派修姆光线：红+银+蓝渐变细条 */}
        <div className="h-0.5 rounded-full mb-3" style={{ background: 'linear-gradient(90deg, transparent 0%, #ef4444 20%, #e5e7eb 50%, #3b82f6 80%, transparent 100%)' }} />
        <h2 className="text-lg font-bold flex items-center gap-2">
          {/* 奥特曼胸灯：红圆 + 闪烁 */}
          <span className="relative inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)] animate-pulse" />
          巴尔坦收藏
        </h2>
        <p className="text-xs text-[#6b7085]">
          来源：<a href="https://ultrakaijyu.com/ultraman/alienbaltan.html" target="_blank" rel="noreferrer" className="text-accent hover:underline">ウルトラ怪獣.com 資料室</a>
        </p>
        <p className="text-xs text-[#6b7085] mt-1">
          共 {data.items.length} 条 · 一代 {gen1.length} · 二代 {gen2.length} · 我现有 {data.owned_count} 件
        </p>
      </div>

      <section>
        <h3 className="text-base font-bold text-[#a0a4b8] mb-3 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          一代（バルタン星人）
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gen1.map(renderItem)}
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold text-[#a0a4b8] mb-3 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          二代（バルタン星人 二代目）
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gen2.map(renderItem)}
        </div>
      </section>
      </div>
    </div>
  );
}
