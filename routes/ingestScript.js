/*
 * GET /api/ingest-script —— 返回任你购抓取脚本文本，并把 __INGEST_KEY__ 占位符替换为真实密钥。
 * 走全局 Bearer token 鉴权（不在 AUTH_WHITELIST 内）。
 * 密钥不写进代码/仓库：服务端从项目根目录 ingest.key 文件读取（gitignore）。
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

function readIngestKey() {
  try {
    const p = path.join(__dirname, '..', 'ingest.key');
    return fs.readFileSync(p, 'utf8').trim() || null;
  } catch (e) {
    return null;
  }
}

router.get('/', (req, res) => {
  const key = readIngestKey();
  if (!key) {
    return res.status(503).json({ error: '服务器未配置导入密钥（ingest.key），请联系管理员' });
  }
  // 生产读 dist/，开发回退 client/public/
  let scriptPath = path.join(__dirname, '..', 'dist', 'fetch_all_details.js');
  if (!fs.existsSync(scriptPath)) {
    scriptPath = path.join(__dirname, '..', 'client', 'public', 'fetch_all_details.js');
  }
  try {
    const text = fs.readFileSync(scriptPath, 'utf8');
    res.type('text/javascript').send(text.split('__INGEST_KEY__').join(key));
  } catch (e) {
    res.status(500).json({ error: '脚本文件不存在，请重新构建前端' });
  }
});

module.exports = router;
