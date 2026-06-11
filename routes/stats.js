const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { enrichToy } = require('../utils/calcCost');

// GET /api/stats
// 用 SQL 聚合替代全表拉到 JS 再 reduce；cost/profit 的 CASE 表达式与 utils/calcCost.js 保持同步
router.get('/', async (req, res) => {
  try {
    const round2 = n => Math.round((n || 0) * 100) / 100;
    const round1 = n => Math.round((n || 0) * 10) / 10;

    const r = await db.get(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('procurement','transit','preorder')
                  OR (procurement_stage IS NOT NULL AND procurement_stage != 'stocked')
                 THEN 1 ELSE 0 END) AS in_transit,
        SUM(CASE WHEN status = 'stock' THEN 1 ELSE 0 END) AS in_stock,
        SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned,
        SUM(CASE WHEN procurement_stage = 'stage1' THEN 1 ELSE 0 END) AS stage1,
        SUM(CASE WHEN procurement_stage = 'stage2' THEN 1 ELSE 0 END) AS stage2,
        SUM(CASE WHEN procurement_stage = 'stage3' THEN 1 ELSE 0 END) AS stage3,
        SUM(CASE WHEN status IN ('procurement','transit','preorder')
                  OR (procurement_stage IS NOT NULL AND procurement_stage != 'stocked')
                 THEN cost ELSE 0 END) AS total_cost_transit,
        SUM(CASE WHEN status = 'stock' THEN cost ELSE 0 END) AS total_cost_stock,
        SUM(CASE WHEN status = 'done' THEN cost ELSE 0 END) AS total_cost_done,
        SUM(CASE WHEN sell_price IS NOT NULL AND sell_price > 0 THEN sell_price ELSE 0 END) AS total_sell,
        SUM(CASE WHEN profit IS NOT NULL THEN profit ELSE 0 END) AS total_profit,
        SUM(CASE WHEN date_month = strftime('%Y-%m','now') THEN cost ELSE 0 END) AS month_cost,
        SUM(CASE WHEN date_month = strftime('%Y-%m','now') AND sell_price IS NOT NULL AND sell_price > 0 THEN sell_price ELSE 0 END) AS month_sell,
        SUM(CASE WHEN date_month = strftime('%Y-%m','now') THEN 1 ELSE 0 END) AS month_count
      FROM (
        SELECT
          status, procurement_stage, sell_price,
          stage1_amount, stage2_amount, stage3_amount,
          source, refund_amount, huabei,
          japan_price_cny, handling_fee, japan_domestic_shipping, japan_consumption_tax,
          intl_shipping, import_duty, proxy_price, proxy_intl_shipping, proxy_domestic_shipping,
          domestic_price, domestic_shipping,
          logistics_fee, box_fee, packing_fee,
          purchase_date, created_at,
          CASE
            WHEN COALESCE(stage1_amount, 0) + COALESCE(stage2_amount, 0) + COALESCE(stage3_amount, 0) > 0
              THEN COALESCE(stage1_amount, 0) + COALESCE(stage2_amount, 0) + COALESCE(stage3_amount, 0)
            ELSE CASE source
              WHEN 'direct' THEN COALESCE(japan_price_cny, 0)
              WHEN 'secondhand' THEN COALESCE(japan_price_cny, 0)
              WHEN 'proxy' THEN COALESCE(proxy_price, 0) + COALESCE(proxy_intl_shipping, 0) + COALESCE(proxy_domestic_shipping, 0)
              WHEN 'domestic' THEN COALESCE(domestic_price, 0) + COALESCE(domestic_shipping, 0)
              ELSE 0
            END
            + COALESCE(handling_fee, 0) + COALESCE(japan_domestic_shipping, 0) + COALESCE(japan_consumption_tax, 0)
            + COALESCE(intl_shipping, 0) + COALESCE(import_duty, 0)
          END
          + COALESCE(logistics_fee, 0) + COALESCE(box_fee, 0) + COALESCE(packing_fee, 0) AS cost,
          CASE WHEN sell_price IS NOT NULL AND sell_price > 0
            THEN sell_price - COALESCE(refund_amount, 0) - COALESCE(huabei, 0)
                 - (CASE
                    WHEN COALESCE(stage1_amount, 0) + COALESCE(stage2_amount, 0) + COALESCE(stage3_amount, 0) > 0
                      THEN COALESCE(stage1_amount, 0) + COALESCE(stage2_amount, 0) + COALESCE(stage3_amount, 0)
                    ELSE CASE source
                      WHEN 'direct' THEN COALESCE(japan_price_cny, 0)
                      WHEN 'secondhand' THEN COALESCE(japan_price_cny, 0)
                      WHEN 'proxy' THEN COALESCE(proxy_price, 0) + COALESCE(proxy_intl_shipping, 0) + COALESCE(proxy_domestic_shipping, 0)
                      WHEN 'domestic' THEN COALESCE(domestic_price, 0) + COALESCE(domestic_shipping, 0)
                      ELSE 0
                    END
                    + COALESCE(handling_fee, 0) + COALESCE(japan_domestic_shipping, 0) + COALESCE(japan_consumption_tax, 0)
                    + COALESCE(intl_shipping, 0) + COALESCE(import_duty, 0)
                  END
                  + COALESCE(logistics_fee, 0) + COALESCE(box_fee, 0) + COALESCE(packing_fee, 0))
            ELSE NULL
          END AS profit,
          strftime('%Y-%m', COALESCE(NULLIF(purchase_date, ''), created_at)) AS date_month
        FROM toys
      )
    `);

    const total_cost_transit = r.total_cost_transit || 0;
    const total_cost_stock = r.total_cost_stock || 0;
    const total_cost_done = r.total_cost_done || 0;
    const total_cost = total_cost_transit + total_cost_stock + total_cost_done;
    const total_sell = r.total_sell || 0;
    const total_profit = r.total_profit || 0;
    const margin_rate = total_sell > 0 ? (total_profit / total_sell * 100) : 0;

    res.json({
      total_cost: round2(total_cost),
      total_cost_transit: round2(total_cost_transit),
      total_cost_stock: round2(total_cost_stock),
      total_cost_done: round2(total_cost_done),
      total_sell: round2(total_sell),
      total_profit: round2(total_profit),
      margin_rate: round1(margin_rate),
      counts: {
        stage1: r.stage1 || 0, stage2: r.stage2 || 0, stage3: r.stage3 || 0,
        in_transit: r.in_transit || 0, in_stock: r.in_stock || 0,
        sold: r.sold || 0, done: r.done || 0, returned: r.returned || 0,
        total: r.total || 0
      },
      month: {
        cost: round2(r.month_cost),
        sell: round2(r.month_sell),
        count: r.month_count || 0
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
