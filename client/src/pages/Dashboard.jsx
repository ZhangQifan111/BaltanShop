import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../stores/useStore';
import { sourceLabel } from '../lib/sources';
import { Package, Truck, Wallet, TrendingUp, TrendingDown, Sparkles, ChevronRight } from 'lucide-react';

// ============================================
// Dashboard v2 · 按设计师方案 design-overview-v2
// 改动要点：
//   A · Hero 横幅（角色装饰已由 BackgroundDecoration 提供，0.15 透明；这里只承载信息）
//   B · KPI 分层（主指标 2 + 次指标 4）
//   C · 横向 bar 替代环形图
//   D · 缩略图列表
//   E · 状态文案映射（兼容老 stage1/2/3）
// ============================================

// 状态文案映射（与设计稿 token 一致）
const STATUS_LABEL = {
  stage1: '询价中',  stage2: '议价中',  stage3: '已拍下',
  stock:  '在库',    sold: '在售',     done: '已完成',
};
const STATUS_BAR = {
  stage1: { fill: 'bar-fill-cyan',    dot: 'bg-cyan-400'   },
  stage2: { fill: 'bar-fill-accent',  dot: 'bg-accent'     },
  stage3: { fill: 'bar-fill-pink',    dot: 'bg-pink-300'   },
  stock:  { fill: 'bar-fill-accent',  dot: 'bg-accent'     },
  done:   { fill: 'bar-fill-emerald', dot: 'bg-emerald-400'},
  sold:   { fill: 'bar-fill-pink',    dot: 'bg-pink-300'   },
};

function HeroBanner({ stats, toys }) {
  const recent = toys.filter(t => t.status === 'stock').slice(0, 8);
  return (
    <div className="relative h-[140px] rounded-xl overflow-hidden border border-white/[0.06] bg-gradient-to-r from-accent/[0.08] via-transparent to-red-500/[0.06]">
      {/* 装饰光晕 */}
      <div className="absolute inset-0 flex items-center justify-between px-12 pointer-events-none">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 blur-2xl" />
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500/20 to-pink-500/10 blur-2xl" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-8">
        <div className="flex items-center gap-1.5 text-accent text-xs font-bold tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Baltan 的怪兽柜</span>
        </div>
        <div className="text-white text-xl md:text-2xl font-bold mt-1">
          {stats.counts?.total || 0} 件手办 ·
          <span className="num text-accent"> ¥{(stats.total_cost_stock || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="text-muted text-sm md:text-lg"> 在库价值</span>
        </div>
        <div className="text-muted text-xs mt-1 hidden md:block">
          最近 30 天入库 {stats.month?.count || 0} 件 · 销售 {stats.counts?.done || 0} 件 · 净利{' '}
          <span className={stats.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            ¥{(stats.total_profit || 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function KpiPrimary({ icon: Icon, label, value, sub, color = 'accent' }) {
  return (
    <div className={`kpi-primary ${color}`}>
      <div className="text-muted text-xs flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="num text-2xl md:text-3xl font-bold text-white mt-2">{value}</div>
      {sub && <div className="text-muted-2 text-[10px] mt-2">{sub}</div>}
    </div>
  );
}

function KpiSecondary({ label, value, sub, valueClass = 'text-white' }) {
  return (
    <div className="kpi-secondary">
      <div className="text-muted text-[10px]">{label}</div>
      <div className={`num text-lg font-semibold mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="text-muted-2 text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

function StockDistribution({ stats }) {
  // 兼容老 stage1/2/3 + 新 in_stock/sold
  const items = [
    { key: 'stage1', count: stats.counts?.stage1 || 0 },
    { key: 'stage2', count: stats.counts?.stage2 || 0 },
    { key: 'stage3', count: stats.counts?.stage3 || 0 },
    { key: 'stock',  count: stats.counts?.in_stock || 0 },
    { key: 'sold',   count: stats.counts?.sold || 0 },
    { key: 'done',   count: stats.counts?.done || 0 },
  ].filter(i => i.count > 0);

  const max = Math.max(1, ...items.map(i => i.count));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-white text-sm font-semibold">库存分布</div>
        <div className="text-muted-2 text-[10px]">共 {stats.counts?.total || 0} 件</div>
      </div>

      <div className="space-y-3">
        {items.map(({ key, count }) => {
          const style = STATUS_BAR[key] || STATUS_BAR.stock;
          const pct = Math.max(0.5, (count / max) * 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className="text-white">{STATUS_LABEL[key] || key}</span>
                </div>
                <div className="text-xs num text-white font-medium">{count} 件</div>
              </div>
              <div className="bar-track">
                <div className={style.fill} style={{ width: pct + '%' }} />
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-xs text-muted-2 text-center py-4">暂无数据</div>
        )}
      </div>
    </div>
  );
}

function RecentList({ toys }) {
  const recent = toys
    .filter(t => t.status === 'stock')
    .slice(0, 5);

  return (
    <div className="card relative">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-white text-sm font-semibold">最近入库</div>
        <Link to="/warehouse" className="text-muted text-xs hover:text-accent flex items-center gap-1">
          查看全部
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-1">
        {recent.map(t => {
          const hasImg = t.image_url || t.image_big_url;
          return (
            <Link
              key={t.id}
              to="/warehouse"
              className="flex items-center gap-3 p-2 rounded-lg row-hover"
            >
              <div className="thumb-placeholder">
                {hasImg ? (
                  <img
                    src={t.image_url || t.image_big_url}
                    alt={t.name}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <Package className="w-6 h-6 text-emerald-400/60" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm truncate">{t.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted">
                    {t.category || 'other'}
                  </span>
                  <span className="text-[10px] text-muted-2">
                    {t.source ? sourceLabel(t.source) : '淘淘 · 任你购'}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="num text-sm font-semibold text-accent">
                  ¥{(t.total_cost || 0).toFixed(0)}
                </div>
                <div className="text-[10px] text-muted-2 mt-0.5">
                  {t.created_at ? new Date(t.created_at).toLocaleDateString('zh-CN') : '—'}
                </div>
              </div>
            </Link>
          );
        })}
        {recent.length === 0 && (
          <div className="text-xs text-muted-2 text-center py-4">暂无在库商品</div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { stats, toys, loadAll } = useStore();

  useEffect(() => {
    loadAll();
  }, []);

  if (!stats) {
    return (
      <div className="text-center text-muted-2 py-20 text-sm">加载中...</div>
    );
  }

  const transit = stats.total_cost_transit || 0;
  const transitCount = stats.counts?.in_transit || 0;

  return (
    <div className="space-y-5">
      {/* A · Hero */}
      <HeroBanner stats={stats} toys={toys} />

      {/* B · KPI 分层 */}
      <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
        {/* 主指标 1：总成本 */}
        <div className="col-span-2 md:col-span-4">
          <KpiPrimary
            icon={Wallet}
            label="总成本"
            value={
              <>
                ¥{(stats.total_cost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-muted text-lg">.{(stats.total_cost || 0).toFixed(2).split('.')[1] || '00'}</span>
              </>
            }
            sub="含在途 · 在库 · 已发售 · 已完成"
          />
        </div>

        {/* 主指标 2：在库价值 */}
        <div className="col-span-2 md:col-span-4">
          <KpiPrimary
            icon={Package}
            label="在库价值"
            color="emerald"
            value={
              <>
                ¥{(stats.total_cost_stock || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span className="text-muted text-lg">.{(stats.total_cost_stock || 0).toFixed(2).split('.')[1] || '00'}</span>
              </>
            }
            sub={`${stats.counts?.in_stock || 0} 件 · 平均 ¥${stats.counts?.in_stock ? Math.round((stats.total_cost_stock || 0) / stats.counts.in_stock) : 0}`}
          />
        </div>

        {/* 次指标 2x2（移动端 1 列、桌面端 2x2） */}
        <div className="col-span-2 md:col-span-4 grid grid-cols-2 gap-3">
          <KpiSecondary
            label="在途成本"
            value={`¥${transit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`${transitCount} 件 · 待到货`}
          />
          <KpiSecondary
            label="总利润"
            value={`¥${(stats.total_profit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`毛利率 ${stats.margin_rate || 0}%`}
            valueClass={stats.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
          <KpiSecondary
            label="销售额"
            value={`¥${(stats.total_sell || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`${stats.counts?.done || 0} 件完成`}
          />
          <KpiSecondary
            label="本月"
            value={`¥${(stats.month?.cost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`${stats.month?.count || 0} 件入库`}
            valueClass="text-muted-2"
          />
        </div>
      </div>

      {/* C · 库存分布 + D · 最近入库 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5">
          <StockDistribution stats={stats} />
        </div>
        <div className="md:col-span-7">
          <RecentList toys={toys} />
        </div>
      </div>

      {/* 移动端：本月概览（折叠在底部） */}
      {(stats.month?.cost > 0 || stats.month?.sell > 0) && (
        <div className="card md:hidden">
          <div className="text-xs text-muted-2 uppercase tracking-widest mb-3">本月概览</div>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">本月成本</span>
              <span className="num text-xl font-bold text-accent">
                ¥{(stats.month?.cost || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-white/5 pt-3">
              <span className="text-sm text-muted">本月销售额</span>
              <span className="num text-xl font-bold text-emerald-400">
                ¥{(stats.month?.sell || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
