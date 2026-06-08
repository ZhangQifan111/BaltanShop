import { useEffect, useState } from 'react';

export default function ImageModal({ src, alt, detailUrl, onClose }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 bg-black/85 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-[92vw] max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {!loaded && (
          <div className="flex items-center justify-center w-64 h-64 text-xs text-[#a0a4b8]">
            加载中…
          </div>
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`max-w-full max-h-[92vh] object-contain rounded shadow-2xl ${loaded ? '' : 'hidden'}`}
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-2 right-2 flex gap-2">
          {detailUrl && (
            <a
              href={detailUrl}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="px-2.5 py-1 rounded bg-black/70 text-white text-xs hover:bg-black/90"
            >
              考据 ↗
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-black/70 text-white text-xs hover:bg-black/90"
          >
            ✕ 关闭
          </button>
        </div>
      </div>
    </div>
  );
}
