/**
 * 计算商品真实总成本
 * 主源：阶段付款 (stage1/2/3) + 物流/纸箱/打包
 * fallback：估算页直接创建的商品 (japan_price_cny + 各项费用)
 */
function calcTotalCost(toy) {
  const stages = (toy.stage1_amount || 0) + (toy.stage2_amount || 0) + (toy.stage3_amount || 0);
  const logistics = (toy.logistics_fee || 0) + (toy.box_fee || 0) + (toy.packing_fee || 0);

  if (stages > 0) return stages + logistics;

  let base = 0;
  if (toy.source === 'direct') {
    base = toy.japan_price_cny || 0;
  } else if (toy.source === 'proxy') {
    base = (toy.proxy_price || 0) + (toy.proxy_intl_shipping || 0) + (toy.proxy_domestic_shipping || 0);
  } else if (toy.source === 'domestic') {
    base = (toy.domestic_price || 0) + (toy.domestic_shipping || 0);
  } else if (toy.source === 'secondhand') {
    base = toy.japan_price_cny || 0;
  }
  const japanFees = (toy.handling_fee || 0) + (toy.japan_domestic_shipping || 0) + (toy.japan_consumption_tax || 0);
  const intlFees = (toy.intl_shipping || 0) + (toy.import_duty || 0);
  return base + japanFees + intlFees + logistics;
}

/**
 * 计算利润
 */
function calcProfit(toy, xFee = 0) {
  if (!toy.sell_price || toy.sell_price <= 0) return null;
  const cost = toy.total_cost || calcTotalCost(toy);
  return toy.sell_price
    - (toy.refund_amount || 0)
    - (toy.huabei || 0)
    - cost
    - xFee;
}

/**
 * 更新 toy 的 total_cost 和 profit 字段
 */
function enrichToy(toy) {
  toy.total_cost = calcTotalCost(toy);
  toy.profit = calcProfit(toy);
  return toy;
}

/**
 * 反向计算：已知 sell_price + 目标利润 + 各项已知费用，倒推进货基准价 (base)
 * 与 calcTotalCost / calcProfit 保持同一份费用定义，勿漂移
 */
function calcBaseFromTarget(input) {
  const sell = Number(input.sell_price) || 0;
  const targetProfit = Number(input.target_profit) || 0;
  const handling = Number(input.handling_fee) || 0;
  const jdomestic = Number(input.japan_domestic_shipping) || 0;
  const intl = Number(input.intl_shipping) || 0;
  const logistics = Number(input.logistics_fee) || 0;
  const box = Number(input.box_fee) || 0;
  const packing = Number(input.packing_fee) || 0;
  const refund = Number(input.refund_amount) || 0;
  const huabei = Number(input.huabei) || 0;
  // 平台手续费 1.6% 硬编码 (从售价扣)
  const xFee = sell * 0.016;

  const source = input.source;
  const isImported = source === 'direct' || source === 'proxy' || source === 'secondhand';
  const directExcluded = source === 'direct' && !input.japan_price_includes_tax;
  // 海关税 13% 对所有进境商品硬编码 (直购/代购/二手)，国内 0
  const cConsumption = directExcluded ? 0.1 : 0;
  const cDuty = isImported ? 0.13 : 0;
  const c = cConsumption + cDuty;

  // import_duty = base × cDuty，循环依赖，从 otherFees 拿掉再代数解
  const fixedFees = handling + jdomestic + intl + logistics + box + packing;
  const deductions = refund + huabei + xFee;
  const cost = sell - deductions - targetProfit;
  const rawBase = (cost - fixedFees) / (1 + c);
  const base = Math.max(0, rawBase);
  const consumptionTax = base * cConsumption;
  const importDuty = base * cDuty;
  const feesTotal = handling + jdomestic + intl + consumptionTax + importDuty + logistics + box + packing;

  const profitRate = sell > 0 ? (targetProfit / sell) * 100 : 0;

  let feasible = true;
  let warning = null;
  if (rawBase < 0) {
    feasible = false;
    const maxBase = Math.max(0, (sell - deductions - fixedFees) / (1 + c));
    const maxProfit = Math.max(0, sell - deductions - fixedFees);
    warning = `目标利润 ${targetProfit.toFixed(2)} 不可行 — 扣完所有费用最多只能给 ${maxBase.toFixed(2)} 进货，最多只能保留 ${maxProfit.toFixed(2)} 利润`;
  }

  return {
    base_price: base,
    cost,
    profit: targetProfit,
    profit_rate: Math.round(profitRate * 10) / 10,
    x_fee: xFee,
    breakdown: {
      base,
      japan_fees_excl_tax: handling + jdomestic,
      japan_consumption_tax: consumptionTax,
      japan_fees: handling + jdomestic + consumptionTax,
      intl_shipping: intl,
      import_duty: importDuty,
      intl_fees: intl + importDuty,
      logistics_fee: logistics,
      box_fee: box,
      packing_fee: packing,
      fees_total: feesTotal,
      sell_price: sell,
      deductions: { refund, huabei, xFee: xFee || 0 },
      tax_mode: source === 'direct' ? (input.japan_price_includes_tax ? 'included' : 'auto_10pct') : 'n/a'
    },
    feasible,
    warning
  };
}

module.exports = { calcTotalCost, calcProfit, enrichToy, calcBaseFromTarget };
