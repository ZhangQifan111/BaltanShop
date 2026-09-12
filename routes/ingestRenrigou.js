/*
 * 浏览器端抓取完成后，把结果 POST 到这里写到 data/orders/orders-{ts}.json
 * CORS 已放通（任意源），只接受本机调用（生产可收紧）
 * 免鉴权原因：抓取脚本在 renrigou.jp 域执行，拿不到本网站的 token；
 * 用简单的共享 key 校验挡住无门槛的随意 POST。
 * 密钥不进代码/仓库：从项目根目录 ingest.key 文件读取（gitignore），
 * 抓取脚本文本由 /api/ingest-script（需登录）动态替换占位符后下发。
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data', 'orders');

function readIngestKey() {
  try {
    const p = path.join(__dirname, '..', 'ingest.key');
    return fs.readFileSync(p, 'utf8').trim() || null;
  } catch (e) {
    return null;
  }
}

router.post('/', (req, res) => {
  try {
    const INGEST_KEY = readIngestKey();
    if (!INGEST_KEY) {
      return res.status(503).json({ error: '服务器未配置导入密钥（ingest.key），请联系管理员' });
    }
    if (req.headers['x-ingest-key'] !== INGEST_KEY) {
      return res.status(401).json({ error: 'invalid ingest key' });
    }
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
