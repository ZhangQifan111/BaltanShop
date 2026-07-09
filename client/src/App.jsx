import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import useStore from './stores/useStore';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import Warehouse from './pages/Warehouse';
import Estimate from './pages/Estimate';

import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Monster from './pages/Monster';
import Renrigou from './pages/Renrigou';
import BackgroundDecoration from './components/BackgroundDecoration';

const NAV = [
  { path: '/', label: '总览', icon: '🏠' },
  { path: '/procurement', label: '采购', icon: '🛒' },
  { path: '/warehouse', label: '仓库', icon: '📦' },
  { path: '/estimate', label: '估算', icon: '💰' },
  { path: '/monster', label: '怪兽', icon: '👹' },
  { path: '/analytics', label: '分析', icon: '📊' },
  { path: '/settings', label: '设置', icon: '⚙️' },
  { path: '/renrigou', label: '任你购', icon: '📋' },
];

function Layout({ children }) {
  const location = useLocation();
  const { toast, bulkImport, dismissBulkImport } = useStore();

  return (
    <div className="min-h-screen bg-bg text-[#d0d4e8] font-mono relative">
      <BackgroundDecoration />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg/95 backdrop-blur border-b border-white/[0.06] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-accent">巴坦杂货铺</h1>
          <span className="text-xs text-[#6b7085]">v2.0</span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur border-t border-white/[0.06] safe-bottom z-50">
        <div className="max-w-6xl mx-auto flex">
          {NAV.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 gap-1 text-[10px] transition-colors ${
                  isActive ? 'text-accent' : 'text-[#6b7085]'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* 全局一键导入进度浮层（切页不丢失） */}
      {bulkImport.active && (
        <div className="fixed top-16 left-3 right-3 z-[110] max-w-md mx-auto">
          <div className="bg-[#1e1e1e] border-2 border-accent rounded-lg p-3 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="flex-1 text-xs text-white font-bold">
                {bulkImport.phase === 'check' && '预检去重中…'}
                {bulkImport.phase === 'translate' && `翻译中 ${bulkImport.done}/${bulkImport.total}`}
                {bulkImport.phase === 'import' && `入库中 ${bulkImport.done}/${bulkImport.total}`}
              </div>
              {bulkImport.skippedCount > 0 && (
                <span className="text-[10px] text-[#8b90a5]">跳过 {bulkImport.skippedCount}</span>
              )}
              <button
                onClick={dismissBulkImport}
                className="text-[#8b90a5] hover:text-white text-base leading-none px-1"
                title="隐藏（不影响后台执行）"
              >✕</button>
            </div>
            {bulkImport.total > 0 && (
              <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: (bulkImport.done / bulkImport.total * 100) + '%' }}
                />
              </div>
            )}
            <div className="text-[10px] text-[#6b7085] mt-1.5">可切到其他页面，进度不丢失</div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-accent text-bg px-5 py-2 rounded-lg text-sm font-medium z-[100] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const loadAll = useStore(s => s.loadAll);

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/estimate" element={<Estimate />} />
          <Route path="/monster" element={<Monster />} />

          <Route path="/analytics" element={<Analytics />} />
          <Route path="/renrigou" element={<Renrigou />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
