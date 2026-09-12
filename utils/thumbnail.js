// 缩略图生成：图片写入 uploads/ 后调用，同目录生成 *_thumb 小图（宽 200px）
// 前端列表用缩略图、点开大图才加载原图；旧图没有缩略图的由前端 onError 回退原图
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function thumbPathOf(filePath) {
  return filePath.replace(/\.(jpe?g|png|webp|gif|avif)$/i, '_thumb.$1');
}

// 同步生成缩略图，失败静默（缩略图是优化项，不该阻塞主流程）
function makeThumb(filePath) {
  const thumb = thumbPathOf(filePath);
  try {
    if (!fs.existsSync(filePath)) return thumb;
    sharp(filePath)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toFile(thumb)
      .then(() => {})
      .catch(() => {});
  } catch (_) {}
  return thumb;
}

module.exports = { makeThumb, thumbPathOf };
