import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

/*
 * 任你购图片补抓面板
 * - 🔍 检查丢失图片 → 调用后端 dry-run 预览
 * - 🔧 一键补抓 → SSE 流式补抓，进度条
 * - 🗑 清理无效图片 → 把指向不存在文件的 image 字段清空
 */
export default function ImageFixPanel() {
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // 'preview' | 'progress' | 'cleanupConfirm' | null
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0, current: '', log: [] });
  const [progressDone, setProgressDone] = useState(null);
  const [toast, setToast] = useState(null);
  const abortRef = useRef(null);

  const showToast = (text, type = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const cancelRun = () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    setModal(null);
    setBusy(false);
    showToast('已取消补抓（已下载的会保留）', 'info');
  };

  // 🔍 检查丢失图片
  const handleCheck = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/fix-renrigou-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      setPreview(data);
      setModal('preview');
    } catch (e) {
      showToast('检查失败: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // 🔧 一键补抓（SSE 流式）
  const handleFix = async () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setProgress({ done: 0, total: 0, ok: 0, fail: 0, current: '', log: [] });
    setProgressDone(null);
    setModal('progress');

    try {
      const res = await fetch('/api/fix-renrigou-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
        signal: controller.signal
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split('\n\n');
        buf = parts.pop() || '';

        for (const part of parts) {
          const eventMatch = part.match(/^event: (.+)\ndata: (.+)$/s);
          if (!eventMatch) continue;
          const eventName = eventMatch[1].trim();
          let data = {};
          try { data = JSON.parse(eventMatch[2]); } catch {}

          if (eventName === 'start') {
            setProgress(p => ({ ...p, total: data.fixableCount, missingCount: data.missingCount }));
          } else if (eventName === 'progress') {
            setProgress(p => ({ ...p, current: data.name }));
          } else if (eventName === 'item_done') {
            setProgress(p => ({
              ...p,
              ok: p.ok + (data.status === 'ok' ? 1 : 0),
              fail: p.fail + (data.status === 'fail' ? 1 : 0),
              done: p.done + 1,
              log: [...p.log.slice(-49), data].slice(-50)
            }));
          } else if (eventName === 'done') {
            setProgressDone({ ok: data.ok, fail: data.fail, total: data.total });
          } else if (eventName === 'skip') {
            setProgress(p => ({
              ...p,
              log: [...p.log.slice(-49), { name: data.name, status: 'skip', reasonLabel: data.reasonLabel }].slice(-50)
            }));
          } else if (eventName === 'error') {
            throw new Error(data.message || 'unknown error');
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        // 用户取消，安静处理
        showToast('已取消（已下载的会保留）', 'info');
      } else {
        showToast('补抓失败: ' + e.message, 'error');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  // 🖼 从最新一次抓取补图（专治重装后老订单丢图、且库里没存 image_url 的情况）
  const handleFixFromScrape = async () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setProgress({ done: 0, total: 0, ok: 0, fail: 0, current: '', log: [] });
    setProgressDone(null);
    setModal('progress');

    try {
      let token = null;
      try { token = localStorage.getItem('token'); } catch {}
      const res = await fetch('/api/fix-renrigou-images/from-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        },
        body: JSON.stringify({}),
        signal: controller.signal
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split('\n\n');
        buf = parts.pop() || '';

        for (const part of parts) {
          const eventMatch = part.match(/^event: (.+)\ndata: (.+)$/s);
          if (!eventMatch) continue;
          const eventName = eventMatch[1].trim();
          let data = {};
          try { data = JSON.parse(eventMatch[2]); } catch {}

          if (eventName === 'start') {
            setProgress(p => ({ ...p, total: data.total, scrapedItems: data.scrapedItems, scannedFile: data.scannedFile }));
          } else if (eventName === 'progress') {
            setProgress(p => ({ ...p, current: data.name }));
          } else if (eventName === 'item_done') {
            setProgress(p => ({
              ...p,
              ok: p.ok + (data.status === 'ok' ? 1 : 0),
              fail: p.fail + (data.status === 'fail' ? 1 : 0),
              done: p.done + 1,
              log: [...p.log.slice(-49), data].slice(-50)
            }));
          } else if (eventName === 'done') {
            setProgressDone({ ok: data.ok, fail: data.fail, total: data.total, scrapedItems: data.scrapedItems });
          } else if (eventName === 'error') {
            throw new Error(data.message || 'unknown error');
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        showToast('已取消（已补回的会保留）', 'info');
      } else {
        showToast('补图失败: ' + e.message, 'error');
        setModal(null);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  // 🗑 清理无效图片
  const handleCleanup = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/fix-renrigou-images/cleanup', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
      showToast('已清理 ' + data.cleaned + ' 条失效图片记录', 'success');
      setModal(null);
    } catch (e) {
      showToast('清理失败: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-3 p-3 bg-bg rounded-lg flex items-center gap-2 flex-wrap">
        <div className="text-[10px] text-[#6b7085] uppercase tracking-widest mr-2">图片维护</div>
        <button
          className="btn-ghost text-xs"
          onClick={handleCheck}
          disabled={busy}
          title="扫描数据库，看哪些商品图丢了、能不能补回来"
        >
          🔍 检查丢失图片
        </button>
        <button
          className="btn-primary text-xs"
          onClick={handleFix}
          disabled={busy}
          title="自动从任你购重新下载丢失的图片"
        >
          🔧 一键补抓图片
        </button>
        <button
          className="btn-primary text-xs"
          onClick={handleFixFromScrape}
          disabled={busy}
          title="重装后老订单没存原始图片网址时用：读最新一次抓取的数据，给缺图的老订单重新下载并补回（记得先在任你购跑一次抓取脚本）"
        >
          🖼 从最新抓取补图（老订单）
        </button>
        <button
          className="btn-ghost text-xs text-red-400"
          onClick={() => setModal('cleanupConfirm')}
          disabled={busy}
          title="把指向不存在文件的 image 字段清空（保留 image_url 留作重试）"
        >
          🗑 清理无效图片
        </button>
      </div>

      {/* 预览弹窗 */}
      {modal === 'preview' && preview && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-[#1a1d27] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#1a1d27] p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-accent">🔍 图片丢失情况</div>
                <div className="text-[10px] text-[#6b7085] mt-1">
                  共扫描 <b className="text-accent">{preview.totalChecked}</b> 条带本地路径的记录，其中 <b className="text-red-400">{preview.missingCount}</b> 张本地图片已丢失
                </div>
              </div>
              <button className="text-[#6b7085] hover:text-white text-xl leading-none" onClick={() => setModal(null)}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 text-center text-xs">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-400">{preview.fixableCount}</div>
                <div className="text-[10px] text-[#6b7085] mt-1">✅ 可补（有原始 URL）</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-400">{preview.unfixableCount}</div>
                <div className="text-[10px] text-[#6b7085] mt-1">❌ 不能补</div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
              {preview.fixableCount > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-green-400 font-bold mb-2">✅ 可补（{preview.fixableCount}）</div>
                  <div className="space-y-1">
                    {preview.fixable.slice(0, 50).map(f => (
                      <div key={f.id} className="bg-bg rounded p-2 text-[11px]">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[#6b7085]">#{f.id}</span>
                          <span className="flex-1 truncate">{f.name}</span>
                        </div>
                        <div className="text-[10px] text-[#6b7085] truncate" title={f.image_url}>{f.image_url}</div>
                      </div>
                    ))}
                    {preview.fixable.length > 50 && (
                      <div className="text-[10px] text-[#6b7085] text-center py-1">
                        还有 {preview.fixable.length - 50} 条未展开...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {preview.unfixableCount > 0 && (
                <div>
                  <div className="text-xs text-red-400 font-bold mb-2">❌ 不能补（{preview.unfixableCount}）</div>
                  <div className="space-y-1">
                    {preview.unfixable.map(u => (
                      <div key={u.id} className="bg-bg rounded p-2 text-[11px]">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[#6b7085]">#{u.id}</span>
                          <span className="flex-1 truncate">{u.name}</span>
                          <span className="text-[10px] text-red-400 shrink-0">{u.reasonLabel}</span>
                        </div>
                        {u.image_url && (
                          <div className="text-[10px] text-[#6b7085] truncate" title={u.image_url}>{u.image_url}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.fixableCount === 0 && preview.unfixableCount === 0 && (
                <div className="text-center text-[#6b7085] py-8 text-xs">
                  🎉 没有丢失的图片！
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-[#1a1d27] p-3 border-t border-white/[0.06] flex gap-2">
              <button className="btn-ghost text-sm flex-1 py-2" onClick={() => setModal(null)}>关闭</button>
              {preview.fixableCount > 0 && (
                <button
                  className="btn-primary text-sm flex-1 py-2"
                  onClick={() => { setModal(null); handleFix(); }}
                  disabled={busy}
                >
                  🔧 立即补抓 {preview.fixableCount} 张
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* 进度弹窗 */}
      {modal === 'progress' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="sticky top-0 bg-[#1a1d27] p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-accent">🔧 正在补抓图片...</div>
                <div className="text-[10px] text-[#6b7085] mt-1">
                  {progressDone ? (
                    <span>✅ 完成：补回 <b className="text-green-400">{progressDone.ok}</b> 张 / 失败 <b className="text-red-400">{progressDone.fail}</b> 张{progressDone.fail > 0 ? '（多为源站图已删）' : ''} / 需补 <b>{progressDone.total}</b> 张{typeof progressDone.scrapedItems === 'number' ? ` · 本次抓取覆盖 ${progressDone.scrapedItems} 件` : ''}</span>
                  ) : progress.total > 0 ? (
                    <span>{progress.done}/{progress.total} · ✅ {progress.ok} ❌ {progress.fail}{progress.current ? ' · 当前: ' + progress.current : ''}</span>
                  ) : (
                    <span>准备中...</span>
                  )}
                </div>
              </div>
              {progressDone && (
                <button className="text-[#6b7085] hover:text-white text-xl leading-none" onClick={() => setModal(null)}>✕</button>
              )}
            </div>

            {progress.total > 0 && !progressDone && (
              <div className="px-4 pt-3">
                <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-200"
                    style={{ width: (progress.done / progress.total * 100) + '%' }}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[11px]">
              {progress.log.length === 0 && !progressDone && (
                <div className="text-center text-[#6b7085] py-4">等待服务器响应...</div>
              )}
              {progress.log.map((it, i) => (
                <div key={i} className={'py-0.5 ' + (
                  it.status === 'ok' ? 'text-green-400' :
                  it.status === 'fail' ? 'text-red-400' :
                  'text-[#6b7085]'
                )}>
                  {it.status === 'ok' && '✅ '}
                  {it.status === 'fail' && '❌ '}
                  {it.status === 'skip' && '⏭ '}
                  {it.name}
                  {it.status === 'skip' && it.reasonLabel ? ` · ${it.reasonLabel}` : ''}
                  {it.status === 'fail' && it.reason ? ` · ${it.reason}` : ''}
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-[#1a1d27] p-3 border-t border-white/[0.06] flex gap-2">
              {progressDone ? (
                <>
                  {progressDone.fail > 0 && (
                    <button
                      className="btn-ghost text-sm flex-1 py-2"
                      onClick={() => setModal(null)}
                    >
                      🗑 去清理 {progressDone.fail} 条失败记录
                    </button>
                  )}
                  <button
                    className="btn-primary text-sm flex-1 py-2"
                    onClick={() => setModal(null)}
                  >
                    完成
                  </button>
                </>
              ) : (
                <button className="btn-ghost text-sm flex-1 py-2" disabled>
                  补抓进行中... 请稍候
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* 清理确认弹窗 */}
      {modal === 'cleanupConfirm' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-[#1a1d27] rounded-xl w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold text-red-400 mb-2">🗑 清理无效图片</div>
            <div className="text-xs text-[#d0d4e8] mb-3 leading-relaxed">
              会把所有 image 指向 <code className="text-[#f0883e]">/uploads/...</code> 但本地文件已不存在的记录，
              <b className="text-red-400">image 字段设为空</b>。
              <br /><br />
              <span className="text-green-400">✅ 保留：</span>image_url（远程 URL）留作日后重试
              <br />
              <span className="text-red-400">❌ 清掉：</span>image 字段（已指向不存在文件）
              <br /><br />
              建议流程：先用「🔧 一键补抓」跑一遍，再来清理仍失败的。
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-sm flex-1 py-2" onClick={() => setModal(null)} disabled={busy}>取消</button>
              <button className="btn-primary text-sm flex-1 py-2 bg-red-500/30 hover:bg-red-500/50 text-red-400" onClick={handleCleanup} disabled={busy}>
                {busy ? '处理中...' : '确认清理'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Toast */}
      {toast && (
        <div className={'fixed top-4 right-4 z-[100] px-4 py-2 rounded-lg shadow-lg text-xs ' + (
          toast.type === 'error' ? 'bg-red-500/90 text-white' :
          toast.type === 'success' ? 'bg-green-500/90 text-white' :
          'bg-bg text-accent border border-accent/30'
        )}>
          {toast.text}
        </div>
      )}
    </>
  );
}
