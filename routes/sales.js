const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { enrichToy } = require('../utils/calcCost');

// POST /api/sales — 卖出 N 件，FIFO 从最早批次扣减
router.post('/', async (req, res) => {
  try {
    const t = req.body;
    const productId = Number(t.product_id);
    const sellQty = Number(t.quantity) || 1;
    const sellPricePerUnit = Number(t.sell_price);

    if (!productId || sellQty <= 0) {
      return res.status(400).json({ error: 'product_id and quantity (>0) required' });
    }
    if (!Number.isFinite(sellPricePerUnit) || sellPricePerUnit <= 0) {
      return res.status(400).json({ error: 'sell_price must be a positive number' });
    }

    // 查出该 product 下所有有库存的批次，按创建时间升序（FIFO）
    // 如果指定了 toy_id，只从该批次扣减
    let batches;
    if (t.toy_id) {
      const batch = await db.get(
        `SELECT * FROM toys WHERE id = ? AND product_id = ? AND status = 'stock' AND remaining > 0`,
        [Number(t.toy_id), productId]
      );
      if (!batch) {
        return res.status(400).json({ error: '指定批次不可用（已售罄或不属于该商品）' });
      }
      if (sellQty > batch.remaining) {
        return res.status(400).json({ error: `该批次库存不足：需 ${sellQty} 件，库存 ${batch.remaining} 件` });
      }
      batches = [batch];
    } else {
      batches = await db.all(
        `SELECT * FROM toys
         WHERE product_id = ? AND status = 'stock' AND remaining > 0
         ORDER BY created_at ASC`,
        [productId]
      );
    }

    if (batches.length === 0) {
      return res.status(400).json({ error: '该商品无可用库存' });
    }

    const totalAvailable = batches.reduce((s, b) => s + (b.remaining || 0), 0);
    if (sellQty > totalAvailable) {
      return res.status(400).json({ error: `库存不足：需 ${sellQty} 件，库存 ${totalAvailable} 件` });
    }

    const sellDate = t.sell_date || new Date().toISOString().slice(0, 10);
    const totalRevenue = sellPricePerUnit * sellQty;

    // 各项扣费（按比例分摊到每件）
    const huabei = Number(t.huabei) || 0;
    const softwareFee = Number(t.software_service_fee) || 0;
    const basicFee = Number(t.basic_software_service_fee) || 0;
    const worryFreeFee = Number(t.worry_free_service_fee) || 0;
    const refundAmount = Number(t.refund_amount) || 0;
    const logisticsFee = Number(t.logistics_fee) || 0;
    const boxFee = Number(t.box_fee) || 0;
    const packingFee = Number(t.packing_fee) || 0;
    const logisticsRegion = t.logistics_region || '';
    const logisticsWeight = Number(t.logistics_weight) || 0;

    const saleIds = [];
    let remainingToSell = sellQty;

    for (const batch of batches) {
      if (remainingToSell <= 0) break;

      const take = Math.min(batch.remaining, remainingToSell);
      const portionRevenue = sellPricePerUnit * take;
      const portionRatio = take / sellQty;

      // 按比例分摊扣费到这一批
      const portionHuabei = Math.round(huabei * portionRatio * 100) / 100;
      const portionSoftware = Math.round(softwareFee * portionRatio * 100) / 100;
      const portionBasic = Math.round(basicFee * portionRatio * 100) / 100;
      const portionWorryFree = Math.round(worryFreeFee * portionRatio * 100) / 100;
      const portionRefund = Math.round(refundAmount * portionRatio * 100) / 100;
      const portionLogistics = Math.round(logisticsFee * portionRatio * 100) / 100;
      const portionBox = Math.round(boxFee * portionRatio * 100) / 100;
      const portionPacking = Math.round(packingFee * portionRatio * 100) / 100;

      // 插入 sale 记录
      const saleSql = `INSERT INTO sales (product_id, toy_id, quantity, sell_price, total_revenue,
        huabei, software_service_fee, basic_software_service_fee, worry_free_service_fee,
        refund_amount, logistics_fee, box_fee, packing_fee,
        logistics_region, logistics_weight, sell_date, notes)
        VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?)`;
      const saleId = await db.insert(saleSql, [
        productId, batch.id, take, sellPricePerUnit, portionRevenue,
        portionHuabei, portionSoftware, portionBasic, portionWorryFree,
        portionRefund, portionLogistics, portionBox, portionPacking,
        logisticsRegion, logisticsWeight, sellDate, t.notes || null,
      ]);
      saleIds.push(saleId);

      // 更新批次库存
      const newRemaining = batch.remaining - take;
      if (newRemaining <= 0) {
        // 该批次卖光了
        db.update(
          `UPDATE toys SET remaining = 0, status = 'sold', sell_price = ?, sell_date = ? WHERE id = ?`,
          [sellPricePerUnit, sellDate, batch.id]
        );
      } else {
        db.update(
          `UPDATE toys SET remaining = ? WHERE id = ?`,
          [newRemaining, batch.id]
        );
      }

      remainingToSell -= take;
    }

    res.json({
      ok: true,
      sale_ids: saleIds,
      product_id: productId,
      quantity: sellQty,
      sell_price_per_unit: sellPricePerUnit,
      total_revenue: totalRevenue,
      sell_date: sellDate,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sales — 销售记录列表
router.get('/', async (req, res) => {
  try {
    const { product_id, toy_id, limit } = req.query;
    const where = [];
    const params = [];
    if (product_id) { where.push('s.product_id = ?'); params.push(product_id); }
    if (toy_id) { where.push('s.toy_id = ?'); params.push(toy_id); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const limitClause = limit ? `LIMIT ${Number(limit)}` : 'LIMIT 200';

    const sql = `SELECT s.*, t.name as toy_name, t.name_zh as toy_name_zh
                 FROM sales s LEFT JOIN toys t ON s.toy_id = t.id
                 ${whereClause} ORDER BY s.created_at DESC ${limitClause}`;
    const sales = await db.all(sql, params);
    res.json(sales);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
