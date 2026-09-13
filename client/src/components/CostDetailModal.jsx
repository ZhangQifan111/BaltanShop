import { X } from 'lucide-react';

/*
 * 成本明细弹窗（只读）：点玩具卡片"成本·明细"打开。
 * 拆分口径与后端 utils/calcCost.js 的 calcTotalCost 完全一致，
 * 合计直接显示 toy.total_cost（与卡片上的成本数字相同）。
 * 若明细分项之和与总成本有差额（老数据未拆分），差额显示为"其他/未细分"。
 */

function detailRows(toy) {
  const rows = [];
  const add = (label, v, sub) => {
    const n = Number(v) || 0;
    if (n > 0) rows.push({ label, value: n, sub });
  };
  // 与 calcCost.js pickActual 同源：对账值 >0 时优先，否则用主字段
  const pickActual = (f, af) => {
    const a = toy[af];
    return (a != null && a > 0) ? Number(a) : (Number(toy[f]) || 0);
  };

  const stages = (toy.stage1_amount || 0) + (toy.stage2_amount || 0) + (toy.stage3_amount || 0);
  if (stages > 0) {
    // 阶段付款模式：①②③；其中 ②③ 若有拆分（手续费/国内物流、国际运费/税费）则按拆分展示
    add('① 买价', toy.stage1_amount);
    const s2h = Number(toy.stage2_handling) || 0, s2s = Number(toy.stage2_domestic_ship) || 0;
    if (s2h + s2s > 0) { add('② 手续费', s2h, true); add('② 国内物流费', s2s, true); }
    else add('② 阶段款', toy.stage2_amount);
    const s3s = Number(toy.stage3_intl_ship) || 0, s3t = Number(toy.stage3_tax) || 0;
    if (s3s + s3t > 0) { add('③ 国际运费', s3s, true); add('③ 税费', s3t, true); }
    else add('③ 阶段款', toy.stage3_amount);
  } else {
    // 估算模式：按来源分列
    const src = toy.source;
    if (src === 'direct') add('日本买价', toy.japan_price_cny);
    else if (src === 'domestic' || src === '咸鱼' || src === 'vx好友') {
      add('国内买价', toy.domestic_price);
      add('国内运费', pickActual('domestic_shipping', 'domestic_shipping_actual'));
    } else if (src === 'secondhand') add('日本买价', toy.japan_price_cny);
    else {
      add('代购价', toy.proxy_price);
      add('代购国际运费', pickActual('proxy_intl_shipping', 'proxy_intl_shipping_actual'));
      add('代购国内运费', pickActual('proxy_domestic_shipping', 'proxy_domestic_shipping_actual'));
    }
    add('手续费', toy.handling_fee);
    add('日本国内运费', pickActual('japan_domestic_shipping', 'japan_domestic_shipping_actual'));
    add('日本消费税', toy.japan_consumption_tax);
    add('国际运费', pickActual('intl_shipping', 'intl_shipping_actual'));
    add('关税', toy.import_duty);
  }
  add('物流费', pickActual('logistics_fee', 'logistics_fee_actual'));
  add('纸箱费', toy.box_fee);
  add('打包费', toy.packing_fee);
  return rows;
}

export default function CostDetailModal({ toy, onClose }) {
  const rows = detailRows(toy);
  const total = Number(toy.total_cost) || 0;
  const sum = rows.reduce((s, r) => s + r.value, 0);
  const unallocated = total - sum;

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm max-h-[85vh] overflow-y-auto"
        style={{ background: '#16161e' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-white text-sm font-bold truncate flex-1 min-w-0">{toy.name_zh || toy.name}</div>
          <button
            className="w-8 h-8 rounded flex items-center justify-center text-[#9ba0b5] hover:text-white"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 明细列表 */}
        {rows.length > 0 ? (
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-baseline justify-between text-xs ${r.sub ? 'pl-5' : ''}`}>
                <span className={r.sub ? 'text-[#9ba0b5]' : 'text-[#c8ccd8]'}>{r.label}</span>
                <span className={`num shrink-0 ${r.sub ? 'text-[#9ba0b5]' : 'text-[#c8ccd8]'}`}>
                  ¥{r.value.toFixed(2)}
                </span>
              </div>
            ))}
            {unallocated > 0.01 && (
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-[#9ba0b5]">其他 / 未细分</span>
                <span className="num shrink-0 text-[#9ba0b5]">¥{unallocated.toFixed(2)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-[#6b7085] text-center py-6">该商品暂无费用明细（成本未拆分）</div>
        )}

        {/* 合计 */}
        <div className="flex items-baseline justify-between border-t border-white/10 mt-4 pt-3">
          <span className="text-xs text-[#6b7085] font-bold">总成本</span>
          <span className="num text-lg font-bold text-accent">¥{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
