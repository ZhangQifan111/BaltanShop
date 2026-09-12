import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { sourceLabel } from '../lib/sources';
import { thumbOf } from '../lib/thumbnail';

/**
 * 销售记录 — 全平台统一视图（单品 + 池）
 * 数据来源：sales 表，按时间倒序
 * 联动：JOIN toys 取购入单价，盈亏=售出-购入
 */
export default function SalesLedger() {
  const [sales, setSales] = useState(null); // null=加载中
  const [toys, setToys] = useState([]); // 玩具映射（toy_id → unit_cost/source）
  const [products, setProducts] = useState([]); // 池映射（product_id → name_zh）
  const [search, setSearch] = useState('');
  const [poolFilter, setPoolFilter] = useState('all'); // all | pool | single
  const [profitFilter, setProfitFilter] = useState('all'); // all | profit | loss

  useEffect(() => {
    Promise.all([
      api.get('/sales?limit=500'),
      api.get('/toys'),
      api.get('/products'),
    ]).then(([s, t, p]) => {
      setSales(Array.isArray(s) ? s : []);
      setToys(Array.isArray(t) ? t : []);
      setProducts(Array.isArray(p) ? p : []);
    }).catch(e => {
      console.error('sales-ledger load error:', e);
      setSales([]);
    });
  }, []);

  const toyMap = useMemo(() => new Map(toys.map(t => [t.id, t])), [toys]);
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  // 单条销售盈亏 = total_revenue - (buyUnit * quantity)
  const enriched = useMemo(() => {
    if (!sales) return [];
    return sales.map(s => {
      const toy = s.toy_id != null ? toyMap.get(s.toy_id) : null;
      const qty = Number(s.quantity) || 0;
      const revenue = Number(s.total_revenue) || 0;
      // 成本计算：整箱/整件场景特殊处理
      let buyCost = 0;
      const toyQty = Number(toy?.quantity) || 1;
      const toyTotalCost = Number(toy?.total_cost) || 0;
      if (toy && toyQty > 0 && toyTotalCost > 0) {
        if (qty >= toyQty) {
          buyCost = toyTotalCost;
        } else {
          buyCost = Math.round((toyTotalCost / toyQty) * qty * 100) / 100;
        }
      } else {
        buyCost = (Number(toy?.unit_cost) || 0) * qty;
      }
      // 各项扣费（与 Dashboard /api/stats 同口径）
      const deductions = (Number(s.huabei) || 0) + (Number(s.refund_amount) || 0)
        + (Number(s.software_service_fee) || 0) + (Number(s.basic_software_service_fee) || 0)
        + (Number(s.worry_free_service_fee) || 0)
        + (Number(s.logistics_fee) || 0) + (Number(s.box_fee) || 0) + (Number(s.packing_fee) || 0);
      const profit = revenue - buyCost - deductions;
      const isPool = !!s.product_id;
      const prod = isPool && s.product_id != null ? productMap.get(s.product_id) : null;
      const isOrphan = !toy;
      return { ...s, buyCost, deductions, profit, isPool, poolName: prod?.name_zh || prod?.name || '', toy_image: toy?.image || null, isOrphan };
    });
  }, [sales, toyMap, productMap]);

  const filtered = useMemo(() => {
    return enriched.filter(s => {
      // 孤儿销售（玩具已被删）默认隐藏
      if (s.isOrphan) return false;
      // 池/单品筛选
      if (poolFilter === 'pool' && !s.isPool) return false;
      if (poolFilter === 'single' && s.isPool) return false;
      // 盈亏筛选
      if (profitFilter === 'profit' && s.profit < 0) return false;
      if (profitFilter === 'loss' && s.profit >= 0) return false;
      // 搜索
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (s.toy_name_zh || s.toy_name || '').toLowerCase();
        const poolName = (s.poolName || '').toLowerCase();
        const notes = (s.notes || '').toLowerCase();
        if (!name.includes(q) && !poolName.includes(q) && !notes.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, poolFilter, profitFilter, search]);

  const stats = useMemo(() => {
    let revenue = 0, cost = 0, profit = 0, count = 0;
    for (const s of filtered || []) {
      revenue += Number(s.total_revenue) || 0;
      cost += Number(s.buyCost) || 0;
      profit += Number(s.profit) || 0;
      count += Number(s.quantity) || 0;
    }
    return { revenue, cost, profit, count };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* 顶部统计 */}
      <div className="card">
        <h2 className="text-base font-bold mb-3 flex items-center gap-2">
          📋 销售记录
          <span className="text-xs text-[#6b7085] font-normal">
            单品 + 池商品统一管理
          </span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatBox label="收入" value={stats.revenue} color="text-blue-300" />
          <StatBox label="成本" value={stats.cost} color="text-[#d0d4e8]" />
          <StatBox label="盈亏" value={stats.profit} color={stats.profit >= 0 ? 'text-emerald-300' : 'text-red-300'} />
          <StatBox label="件数" value={stats.count} color="text-accent" plain />
        </div>
      </div>

      {/* 筛选 */}
      <div className="card space-y-2">
        <input className="input" placeholder="🔍 搜索玩具名/池名/备注..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <FilterBtn active={poolFilter === 'all'} onClick={() => setPoolFilter('all')}>全部</FilterBtn>
          <FilterBtn active={poolFilter === 'pool'} onClick={() => setPoolFilter('pool')}>池商品</FilterBtn>
          <FilterBtn active={poolFilter === 'single'} onClick={() => setPoolFilter('single')}>单品</FilterBtn>
          <div className="w-px bg-white/10 mx-1" />
          <FilterBtn active={profitFilter === 'all'} onClick={() => setProfitFilter('all')}>全盈亏</FilterBtn>
          <FilterBtn active={profitFilter === 'profit'} onClick={() => setProfitFilter('profit')} color="green">仅赚</FilterBtn>
          <FilterBtn active={profitFilter === 'loss'} onClick={() => setProfitFilter('loss')} color="red">仅亏</FilterBtn>
        </div>
      </div>

      {/* 列表 */}
      {sales === null ? (
        <div className="text-center text-xs text-[#6b7085] py-8">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-xs text-[#6b7085] py-8">
          {enriched.length === 0 ? '还没有任何销售记录' : '没有匹配的记录'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <SaleRow key={s.id} s={s} productMap={productMap} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color, plain }) {
  return (
    <div className="bg-white/[0.04] rounded-lg p-2 text-center">
      <div className="text-xs text-[#6b7085] mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${color}`}>
        {plain ? value : `¥${Math.round(value).toLocaleString()}`}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children, color }) {
  const baseColor = color === 'green'
    ? (active ? 'bg-emerald-500/30 border-emerald-500 text-emerald-200' : 'border-white/10 text-[#9ba0b5] hover:bg-emerald-500/10')
    : color === 'red'
    ? (active ? 'bg-red-500/30 border-red-500 text-red-200' : 'border-white/10 text-[#9ba0b5] hover:bg-red-500/10')
    : (active ? 'bg-accent text-[#0f1117] border-accent font-semibold' : 'border-white/10 text-[#9ba0b5] hover:bg-white/5');
  return (
    <button type="button" onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${baseColor}`}>
      {children}
    </button>
  );
}

function SaleRow({ s, productMap }) {
  const isProfit = Number(s.profit) >= 0;
  const sign = isProfit ? '+' : '';
  const profitColor = isProfit ? 'text-emerald-300' : 'text-red-300';
  // 优先取玩具图，没有则取池封面图（销售单可能没绑图片但池有）
  const image = s.toy_image || (s.isPool && s.product_id != null && productMap ? productMap.get(s.product_id)?.image : null);
  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-2">
        {image ? (
          <img src={thumbOf(image)} data-full={image} alt="" className="w-14 h-14 rounded-lg object-cover bg-white/5 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-accent/50 transition-all" loading="lazy" decoding="async"
            onClick={() => window.open(image, '_blank')}
            onError={e => { const f = e.currentTarget.dataset.full; if (f && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = '1'; e.currentTarget.src = f; } else e.currentTarget.style.display = 'none'; }} />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-white/[0.04] border border-dashed border-white/10 flex items-center justify-center text-[#6b7085] text-xl shrink-0">
            📦
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">
            {s.toy_name_zh || s.toy_name || '未命名'}
          </div>
          <div className="text-xs text-[#6b7085] mt-0.5">
            {s.isPool ? `🏷 池：${s.poolName}` : '📦 单品'}
            {s.source && ` · ${sourceLabel(s.source) || s.source}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold text-blue-300">
            ¥{Math.round(s.total_revenue || 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#6b7085]">
            ¥{Math.round(s.sell_price || 0)}/件 × {s.quantity}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white/[0.03] rounded p-1.5 text-center">
          <div className="text-xs text-[#6b7085]">成本</div>
          <div className="text-[#d0d4e8]">¥{Math.round(s.buyCost).toLocaleString()}</div>
        </div>
        <div className="bg-white/[0.03] rounded p-1.5 text-center">
          <div className="text-xs text-[#6b7085]">盈亏</div>
          <div className={`font-bold ${profitColor}`}>{sign}¥{Math.abs(Math.round(s.profit)).toLocaleString()}</div>
        </div>
        <div className="bg-white/[0.03] rounded p-1.5 text-center">
          <div className="text-xs text-[#6b7085]">日期</div>
          <div className="text-[#d0d4e8]">{s.sell_date || s.created_at?.slice(0, 10)}</div>
        </div>
      </div>
      {s.logistics_region && (
        <div className="text-xs text-[#6b7085] mt-2">
          物流：{s.logistics_region}{s.logistics_weight ? ` · ${s.logistics_weight}kg` : ''}{s.logistics_fee > 0 ? ` · ¥${Math.round(s.logistics_fee)}` : ''}
        </div>
      )}
      {s.notes && (
        <div className="text-xs text-yellow-300/80 bg-yellow-500/10 rounded px-2 py-1 mt-2">
          📝 {s.notes}
        </div>
      )}
    </div>
  );
}