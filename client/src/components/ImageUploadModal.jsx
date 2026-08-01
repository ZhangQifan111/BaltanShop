import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';

/*
 * 通用补图弹窗：给 toys 或 products 补图用
 *
 * props:
 *   endpoint  — 后端接口基址，如 '/api/toys' 或 '/api/products'
 *   targetId  — 目标资源 id（toys.id 或 products.id）
 *   currentImage — 当前图 URL（用于预览/对比）
 *   label     — 标题副标题，如 '池封面' 或 '商品图'
 *   onDone    — 完成后回调 (newImagePath) => void
 *   onCancel  — 关闭回调
 */
export default function ImageUploadModal({ endpoint, targetId, currentImage, label = '图', onDone, onCancel }) {
  const [tab, setTab] = useState('upload'); // 'upload' | 'url'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [preview, setPreview] = useState(currentImage || null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError('文件超过 5MB');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
    // 自动上传
    submitBase64(reader.result, f.name);
  };

  const submitBase64 = async (dataUrl, filename) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`${endpoint}/${targetId}/image-base64`, { data: dataUrl, filename });
      if (!r.ok) throw new Error(r.error || '上传失败');
      onDone(r.image);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitUrl = async () => {
    if (!urlInput.trim()) { setError('请填写 URL'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`${endpoint}/${targetId}/image-from-url`, { url: urlInput.trim() });
      if (!r.ok) throw new Error(r.error || '下载失败');
      onDone(r.image);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm font-bold">📷 补{label}</div>
          <button className="text-[#6b7085] hover:text-white text-xl leading-none" onClick={onCancel}>✕</button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-white/10">
          <button
            className={`flex-1 py-2 text-xs font-medium ${tab === 'upload' ? 'text-accent border-b-2 border-accent' : 'text-[#6b7085] hover:text-white'}`}
            onClick={() => setTab('upload')}
          >本地上传</button>
          <button
            className={`flex-1 py-2 text-xs font-medium ${tab === 'url' ? 'text-accent border-b-2 border-accent' : 'text-[#6b7085] hover:text-white'}`}
            onClick={() => setTab('url')}
          >粘贴 URL</button>
        </div>

        {/* 预览区 */}
        <div className="p-4">
          <div className="aspect-square w-full max-w-[200px] mx-auto bg-black/30 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
            {preview
              ? <img src={preview} alt="" className="w-full h-full object-contain" />
              : <div className="text-[#4b5065] text-xs">暂无图片</div>}
          </div>

          {tab === 'upload' && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
              <button
                className="btn-primary w-full text-xs py-2"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {busy ? '上传中...' : '📁 选择本地图片'}
              </button>
              <p className="text-[10px] text-[#6b7085] text-center mt-2">支持 JPG / PNG / WebP，最大 5MB</p>
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-2">
              <input
                className="input text-xs w-full"
                placeholder="https://..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitUrl(); }}
                disabled={busy}
              />
              <button
                className="btn-primary w-full text-xs py-2"
                onClick={submitUrl}
                disabled={busy || !urlInput.trim()}
              >
                {busy ? '下载中...' : '⬇ 下载并应用'}
              </button>
              <p className="text-[10px] text-[#6b7085] text-center">支持任意可公开访问的图片 URL</p>
            </div>
          )}

          {error && (
            <div className="mt-3 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-xs text-red-400">
              ❌ {error}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
