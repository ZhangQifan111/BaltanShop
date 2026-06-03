import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import useStore from './stores/useStore';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import Warehouse from './pages/Warehouse';
import Estimate from './pages/Estimate';

import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Baltan from './pages/Baltan';

const NAV = [
  { path: '/', label: '总览', icon: '🏠' },
  { path: '/procurement', label: '采购', icon: '🛒' },
  { path: '/warehouse', label: '仓库', icon: '📦' },
  { path: '/estimate', label: '估算', icon: '💰' },
  { path: '/baltan', label: '巴坦', icon: '👽' },
  { path: '/analytics', label: '分析', icon: '📊' },
  { path: '/settings', label: '设置', icon: '⚙️' },
];

function Layout({ children }) {
  const location = useLocation();
  const { toast } = useStore();

  return (
    <div className="min-h-screen bg-bg text-[#d0d4e8] font-mono">
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
          <Route path="/baltan" element={<Baltan />} />

          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
