/*
 * 浏览器端抓取完成后，把结果 POST 到这里写到 data/orders/orders-{ts}.json
 * CORS 已放通（任意源），只接受本机调用（生产可收紧）
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data', 'orders');

router.post('/', (req, res) => {
  try {
    const { orders } = req.body || {};
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders 必须为数组' });
    }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = 'orders-' + ts + '.json';
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(orders));
    return res.json({ ok: true, savedFile: filename, orderCount: orders.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
