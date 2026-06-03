export default function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold mb-2">{title || '确认操作'}</h3>
        <p className="text-sm text-[#6b7085] mb-6">{message || '确定要执行此操作吗？'}</p>
        <div className="flex gap-3">
          <button className="btn-primary flex-1 text-xs" onClick={onConfirm}>确认</button>
          <button className="btn-ghost flex-1 text-xs" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
