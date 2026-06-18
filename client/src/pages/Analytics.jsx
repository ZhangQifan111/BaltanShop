import { useState, useEffect } from 'react';
import useStore from '../stores/useStore';
import { api } from '../lib/api';
import { sourceGroup } from '../lib/sources';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#f0a030', '#60a5fa', '#a78bfa', '#34d399', '#f87171'];

const SOURCE_GROUPS = ['direct', 'proxy', 'domestic', 'secondhand'];
const SOURCE_COLORS = { direct: '#f0a030', proxy: '#60a5fa', domestic: '#34d399', secondhand: '#a78bfa' };
const SOURCE_NAMES = { direct: '直购', proxy: '海淘/代购', domestic: '国内', secondhand: '二手' };

export default function Analytics() {
  const { toys, stats } = useStore();
  const [products, setProducts] = useState([]);
  const [marketPrices, setMarketPrices] = useState({});

  useEffect(() => {
    api.get('/products').then(prods => setProducts(prods)).catch(() => {});
  }, [toys]);

  // 利润排行
  const profitable = toys
    .filter(t => t.profit != null && t.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  // 来源分布 — 按业务分组聚合（海淘/代购系列归入 proxy，咸鱼/vx好友归入 domestic）
  const filtered = toys.filter(t => t.status !== 'procurement' && t.status !== 'transit' && t.status !== 'preorder');
  const sourceData = SOURCE_GROUPS.map(g => ({
    name: SOURCE_NAMES[g],
    value: filtered.filter(t => sourceGroup(t.source) === g).length,
    fill: SOURCE_COLORS[g],
  })).filter(d => d.value > 0);

  // 成本构成（直购各费用占比）
  const costBreakdown = toys
    .filter(t => t.status === 'done' || t.status === 'sold')
    .reduce((acc, t) => {
      acc.japan += (t.japan_price_cny || 0) + (t.handling_fee || 0) + (t.japan_domestic_shipping || 0);
      acc.intl += (t.intl_shipping || 0) + (t.tax || 0);
      acc.logistics += (t.logistics_fee || 0) + (t.box_fee || 0) + (t.packing_fee || 0);
      return acc;
    }, { japan: 0, intl: 0, logistics: 0 });

  const breakdownData = [
    { name: '日本费用', value: costBreakdown.japan, fill: '#f0a030' },
    { name: '国际费用', value: costBreakdown.intl, fill: '#60a5fa' },
    { name: '国内物流', value: costBreakdown.logistics, fill: '#a78bfa' },
  ].filter(d => d.value > 0);

  // 亏损商品
  const losses = toys
    .filter(t => t.profit != null && t.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">数据分析</h2>
        <p className="text-xs text-[#6b7085]">全流程可视化</p>
      </div>

      {/* 利润排行 */}
      <div className="card">
        <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">利润排行 TOP10</div>
        {profitable.length > 0 ? (
          <div className="space-y-2">
            {profitable.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-4 text-xs text-[#6b7085]">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{t.name}</div>
                </div>
                <div className="text-sm font-bold text-green-400">+¥{t.profit?.toFixed(0)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#6b7085] text-center py-6">暂无利润数据</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 来源分布 */}
        <div className="card">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">采购来源</div>
          {sourceData.length > 0 ? (
            <>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
                      {sourceData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#d0d4e8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2">
                {sourceData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                    <span className="text-[#a0a4b8] flex-1">{d.name}</span>
                    <span className="font-bold" style={{ color: d.fill }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-[#6b7085] text-center py-6">暂无数据</div>
          )}
        </div>

        {/* 成本构成 */}
        <div className="card">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">成本构成</div>
          {breakdownData.length > 0 ? (
            <>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdownData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50}>
                      {breakdownData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => [`¥${v.toLocaleString()}`, '']} contentStyle={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#d0d4e8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2">
                {breakdownData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                    <span className="text-[#a0a4b8] flex-1">{d.name}</span>
                    <span className="font-bold" style={{ color: d.fill }}>¥{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-[#6b7085] text-center py-6">暂无数据</div>
          )}
        </div>
      </div>

      {/* 亏损商品 */}
      {losses.length > 0 && (
        <div className="card">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">亏损商品</div>
          <div className="space-y-2">
            {losses.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div>
                  <div className="text-xs">{t.name}</div>
                  <div className="text-[10px] text-[#6b7085]">售价 ¥{t.sell_price} · 成本 ¥{t.total_cost?.toFixed(0)}</div>
                </div>
                <div className="text-sm font-bold text-red-400">¥{t.profit?.toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 池商品分析 */}
      {products.length > 0 && (
        <div className="card">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">池商品分析 — 回本 / 估值</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#6b7085]">
                  <th className="text-left py-2 pr-3">商品</th>
                  <th className="text-right py-2 px-2">总成本</th>
                  <th className="text-right py-2 px-2">已入库</th>
                  <th className="text-right py-2 px-2">在库</th>
                  <th className="text-right py-2 px-2">均价</th>
                  <th className="text-right py-2 px-2">已回款</th>
                  <th className="text-center py-2 px-2">回本</th>
                  <th className="text-right py-2 px-2">待收回</th>
                  <th className="text-right py-2 px-2">回本卖价</th>
                  <th className="text-right py-2 px-2">赚10%卖价</th>
                  <th className="text-right py-2 pl-2">估值</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const mp = Number(marketPrices[p.id]) || 0;
                  const valuation = mp > 0 ? mp * p.total_remaining : 0;
                  const recovered = p.total_revenue || 0;
                  const remaining = p.total_remaining || 0;
                  const breakEvenPrice = remaining > 0 ? (p.unrecovered_cost || 0) / remaining : 0;
                  const profit10Price = remaining > 0 ? ((p.total_cost || 0) * 1.1 - recovered) / remaining : 0;
                  return (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2 pr-3 max-w-[180px] truncate">{p.name_zh || p.name}</td>
                      <td className="text-right py-2 px-2">¥{(p.total_cost || 0).toFixed(0)}</td>
                      <td className="text-right py-2 px-2">{p.total_qty || 0}</td>
                      <td className="text-right py-2 px-2 font-bold text-accent">{p.total_remaining || 0}</td>
                      <td className="text-right py-2 px-2">¥{(p.avg_unit_cost || 0).toFixed(0)}</td>
                      <td className="text-right py-2 px-2">¥{recovered.toFixed(0)}</td>
                      <td className="text-center py-2 px-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${(p.breakeven_rate || 0) >= 100 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                          {p.breakeven || '—'}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 text-red-400">¥{(p.unrecovered_cost || 0).toFixed(0)}</td>
                      <td className={`text-right py-2 px-2 font-bold ${remaining > 0 && breakEvenPrice > 0 ? 'text-yellow-400' : 'text-[#6b7085]'}`}>
                        {remaining > 0 ? `¥${breakEvenPrice.toFixed(0)}` : '—'}
                      </td>
                      <td className={`text-right py-2 px-2 font-bold ${remaining > 0 && profit10Price > 0 ? 'text-green-400' : 'text-[#6b7085]'}`}>
                        {remaining > 0 ? `¥${Math.max(0, profit10Price).toFixed(0)}` : '—'}
                      </td>
                      <td className="text-right py-2 pl-2">
                        <input
                          className="input text-xs w-20 text-right"
                          type="text" inputmode="decimal" placeholder="市价"
                          value={marketPrices[p.id] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setMarketPrices(prev => ({ ...prev, [p.id]: val }));
                          }}
                        />
                        {mp > 0 && p.total_remaining > 0 && (
                          <div className={`text-[10px] mt-0.5 ${valuation >= p.unrecovered_cost ? 'text-green-400' : 'text-red-400'}`}>
                            ¥{valuation.toFixed(0)}
                            {valuation >= p.unrecovered_cost ? ' ✓覆盖' : ''}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-[#6b7085] mt-3">
            输入市价后自动计算库存估值（在库 × 市价），绿色表示估值可覆盖剩余成本
          </div>
        </div>
      )}

      {/* 关键指标 */}
      {stats && (
        <div className="card">
          <div className="text-xs text-[#6b7085] uppercase tracking-widest mb-4">关键指标</div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-accent">{stats.margin_rate}%</div>
              <div className="text-[10px] text-[#6b7085] mt-1">毛利率</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{stats.counts?.done || 0}</div>
              <div className="text-[10px] text-[#6b7085] mt-1">已完成订单</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{stats.counts?.in_stock || 0}</div>
              <div className="text-[10px] text-[#6b7085] mt-1">在库商品</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
