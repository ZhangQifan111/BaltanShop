const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const UPLOADS = path.join(__dirname, '..', 'uploads');

// GET /api/monster-images - list available reference images for bg decoration
router.get('/', async (req, res) => {
  try {
    const monsterDir = path.join(UPLOADS, 'monster');
    if (!fs.existsSync(monsterDir)) return res.json({ images: [] });

    const dirs = fs.readdirSync(monsterDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();

    const images = [];
    for (const dir of dirs) {
      const dirPath = path.join(monsterDir, dir);
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('-big.png'));
      if (files.length === 0) continue;
      images.push({
        character: dir,
        label: `${dir} (${files.length}张)`,
        preview: `/uploads/monster/${dir}/${files[0]}`,
        images: files.map(f => ({
          name: f,
          url: `/uploads/monster/${dir}/${f}`,
        })),
      });
    }
    res.json({ images });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/process-toy-image
// body: { url: '/uploads/monster/gomora/gomora-01-big.png' }
router.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    // If already a toy image, return as-is
    if (url.includes('-toy')) return res.json({ toy_url: url });

    const relPath = url.replace(/^\/uploads\//, '');
    const srcPath = path.join(UPLOADS, relPath);
    if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'source image not found: ' + srcPath });

    // Determine output path
    const parsed = path.parse(srcPath);
    const outName = parsed.name.replace(/-big$/, '') + '-toy' + parsed.ext;
    const outPath = path.join(parsed.dir, outName);
    const toyUrl = url.replace(/[^/]+$/, outName);

    // If already exists, return it
    if (fs.existsSync(outPath)) return res.json({ toy_url: toyUrl });

    // Run Python script to process
    const script = path.join(__dirname, '..', 'utils', 'makeToyImage.py');
    await new Promise((resolve, reject) => {
      execFile('python3', [script, srcPath, outPath], { timeout: 30000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (fs.existsSync(outPath)) {
      res.json({ toy_url: toyUrl });
    } else {
      res.status(500).json({ error: 'processing failed, output not created' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
