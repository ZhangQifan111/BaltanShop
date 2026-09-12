const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const BACKUP_DIR = path.join(__dirname, '..', 'db', 'backups');
const MAX_BACKUPS = 10;

// 每日自动备份（server.js 启动时调用一次即可）
let autoBackupTimer = null;
function startAutoBackup() {
  if (autoBackupTimer) return;
  autoBackupTimer = setInterval(() => {
    try {
      const b = createBackup();
      console.log(`[backup] 每日自动备份完成: ${b.filename} (${(b.size / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.error('[backup] 每日自动备份失败:', e.message);
    }
  }, 24 * 60 * 60 * 1000);
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function createBackup() {
  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${ts}.db`;
  const filepath = path.join(BACKUP_DIR, filename);

  const data = db.exportBuffer();
  fs.writeFileSync(filepath, data);
  const size = fs.statSync(filepath).size;

  try {
    db.insert('INSERT INTO backup_log (filename, size) VALUES (?, ?)', [filename, size]);
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ file: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const f of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, f.file));
      try { db.update('DELETE FROM backup_log WHERE filename = ?', [f.file]); } catch(e) {}
    }
  } catch(e) {}

  return { filename, size };
}

module.exports = { createBackup, startAutoBackup, router };

// GET /api/backups - list backups
router.get('/', (req, res) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const st = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: st.size, mtime: st.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backup - create backup
router.post('/', (req, res) => {
  try {
    const backup = createBackup();
    if (backup) {
      res.json({ ok: true, ...backup });
    } else {
      res.status(500).json({ error: 'Backup failed' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/backup/download/:filename
router.get('/download/:filename', (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    if (safe !== req.params.filename || !/^[\w.\-]+$/.test(safe)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filepath = path.join(BACKUP_DIR, safe);
    if (!filepath.startsWith(BACKUP_DIR + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
    res.download(filepath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
