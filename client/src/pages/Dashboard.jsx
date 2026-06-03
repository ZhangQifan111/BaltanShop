import useStore from '../stores/useStore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#f0a030', '#60a5fa', '#a78bfa', '#34d399', '#f87171'];

function StatCard({ label, value, sub, color = '#d0d4e8' }) {
  return (
    <div className="card flex-1 min-w-0">
      <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mb-2">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[#6b7085] mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { stats, toys, loadAll } = useStore();

  if (!stats) return <div className="text-center text-[#6b7085] py-20">加载中...</div>;

  const stageData = [
    { name: '阶段①', value: stats.counts?.stage1 || 0, fill: '#f0a030' },
    { name: '阶段②', value: stats.counts?.stage2 || 0, fill: '#60a5fa' },
    { name: '阶段③', value: stats.counts?.stage3 || 0, fill: '#a78bfa' },
    { name: '在库', value: stats.counts?.in_stock || 0, fill: '#34d399' },
    { name: '已售', value: stats.counts?.sold || 0, fill: '#f87171' },
  ].filter(d => d.value > 0);

  const monthData = [
    { label: '本月成本', value: stats.month?.cost || 0, fill: '#f0a030' },
    { label: '本月销售额', value: stats.month?.sell || 0, fill: '#34d399' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap">
        <StatCard label="总成本" value={`¥${(stats.total_cost || 0).toLocaleString()}`} sub="含在途+在库+已完成" />
        <StatCard label="在途成本" value={`¥${(stats.total_cost_transit || 0).toLocaleString()}`} sub={`${stats.counts?.in_transit || 0} 件`} color="#f0a030" />
        <StatCard label="在库价值" value={`¥${(stats.total_cost_stock || 0).toLocaleString()}`} sub={`${stats.counts?.in_stock || 0} 件`} color="#60a5fa" />
      </div>
      <div className="flex gap-3 flex-wrap">
        <StatCard label="销售额" value={`¥${(stats.total_sell || 0).toLocaleString()}`} sub={`${stats.counts?.done || 0} 件已完成`} color="#34d399" />
        <StatCard label="总利润" value={`¥${(stats.total_profit || 0).toLocaleString()}`} sub={`毛利率 ${stats.margin_rate || 0}%`} color={stats.total_profit >= 0 ? '#34d399' : '#f87171'} />
        <StatCard label="本月" value={`¥${(stats.month?.cost || 0).toLocaleString()}`} sub={`${stats.month?.count || 0} 件入库`} color="#a78bfa" />
      </div>

      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">商品状态分布</div>
        <div className="flex gap-6 items-center flex-wrap">
          <div className="w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stageData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                  {stageData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#d0d4e8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {stageData.map(d => (
              <div key={d.name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                <span className="text-xs text-[#a0a4b8] flex-1">{d.name}</span>
                <span className="text-xs font-bold" style={{ color: d.fill }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {monthData[0].value > 0 && (
        <div className="card">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">本月概览</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" tick={{ fill: '#6b7085', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`¥${v.toLocaleString()}`, '']} contentStyle={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#d0d4e8' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {monthData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-3">最近入库</div>
        <div className="space-y-2">
          {toys.filter(t => t.status === 'stock').slice(0, 5).map(t => (
            <div key={t.id} className="flex justify-between items-center py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-[10px] text-[#6b7085]">{t.category} · {t.source === 'direct' ? '直购' : t.source === 'proxy' ? '代购' : '国内'}</div>
              </div>
              <div className="text-sm font-bold text-accent">¥{t.total_cost?.toFixed(0) || 0}</div>
            </div>
          ))}
          {toys.filter(t => t.status === 'stock').length === 0 && (
            <div className="text-xs text-[#6b7085] text-center py-4">暂无在库商品</div>
          )}
        </div>
      </div>
    </div>
  );
}
