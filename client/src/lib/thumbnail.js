// 缩略图 URL 工具：列表卡片用 200px 小图，点开大图预览才加载原图
// 旧图片没有 _thumb 文件时，onError 回退原图（见各 img 标签的 data-full + onError 写法）
export function thumbOf(url) {
  if (!url) return url;
  return String(url).replace(/\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i, '_thumb.$1');
}

// img 通用回退：缩略图 404/不存在时换回原图
export function thumbOnError(e) {
  const el = e.currentTarget;
  const full = el.dataset.full;
  if (full && !el.dataset.fb) {
    el.dataset.fb = '1';
    el.src = full;
  }
}
