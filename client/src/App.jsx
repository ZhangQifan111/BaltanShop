import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import useStore from './stores/useStore';
import { auth } from './lib/api';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import Warehouse from './pages/Warehouse';
import Estimate from './pages/Estimate';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Monster from './pages/Monster';
import Renrigou from './pages/Renrigou';
import Login from './pages/Login';
import BackgroundDecoration from './components/BackgroundDecoration';
import ErrorBoundary from './components/ErrorBoundary';
import {
  LayoutGrid, ShoppingCart, Package, Calculator, Heart,
  BarChart3, ClipboardList, Settings as SettingsIcon,
  User, Rocket, Lock, LogOut, X as XIcon
} from 'lucide-react';

// 8-tab 完整导航：总览 / 采购 / 仓库 / 估价 / 收藏 / 分析 / 任你购 / 设置
// icon 用 lucide-react 替代 emoji（修复 Linux Chrome 裂图问题）
const NAV = [
  { path: '/',           label: '总览',   icon: LayoutGrid },
  { path: '/procurement',label: '采购',   icon: ShoppingCart },
  { path: '/warehouse',  label: '仓库',   icon: Package },
  { path: '/estimate',   label: '估价',   icon: Calculator },
  { path: '/monster',    label: '怪兽',   icon: Heart },
  { path: '/analytics',  label: '分析',   icon: BarChart3 },
  { path: '/renrigou',   label: '任你购', icon: ClipboardList },
  { path: '/settings',   label: '设置',   icon: SettingsIcon },
];

function ChangePasswordModal({ onClose, onDone }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!oldPassword || !newPassword) return setError('旧密码和新密码必填');
    if (newPassword.length < 6) return setError('新密码至少 6 位');
    if (newPassword !== confirm) return setError('两次输入的新密码不一致');
    setLoading(true);
    try {
      await auth.changePassword(oldPassword, newPassword);
      onDone();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-accent" />
          <span>修改密码</span>
        </div>
        <div className="space-y-2">
          <input className="input w-full text-sm" type="password" placeholder="旧密码" value={oldPassword} onChange={e => setOldPassword(e.target.value)} autoFocus />
          <input className="input w-full text-sm" type="password" placeholder="新密码（至少 6 位）" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <input className="input w-full text-sm" type="password" placeholder="再次输入新密码" value={confirm} onChange={e => setConfirm(e.target.value)} />
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1 text-xs" onClick={onClose}>取消</button>
            <button className="btn-primary flex-1 text-xs" onClick={submit} disabled={loading}>{loading ? '保存中…' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserMenu({ username, onChangePassword }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-[#9ba0b5] hover:text-accent px-2 py-1 rounded transition-colors"
      >
        <User className="w-4 h-4" />
        <span>{username}</span>
        <span className="text-[10px]">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl z-[100] min-w-[140px] py-1">
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-[#d0d4e8]"
              onClick={() => { setOpen(false); onChangePassword(); }}
            ><Lock className="w-3.5 h-3.5" /> 修改密码</button>
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.06] text-red-400"
              onClick={() => { setOpen(false); auth.logout(); }}
            ><LogOut className="w-3.5 h-3.5" /> 退出登录</button>
          </div>
        </>
      )}
    </div>
  );
}

function Layout({ children }) {
  const location = useLocation();
  const { toast, bulkImport, dismissBulkImport } = useStore();
  const [me, setMe] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    auth.me().then(r => setMe(r.user)).catch(() => setMe(null));
  }, []);

  return (
    <div className="min-h-screen bg-bg text-[#d0d4e8] font-mono relative">
      <BackgroundDecoration />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg/95 backdrop-blur border-b border-white/[0.06] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-accent flex items-center gap-1.5">
            <Rocket className="w-5 h-5" />
            <span>秘密基地</span>
          </h1>
          <div className="flex items-center gap-3">
            {me && <UserMenu username={me.username} onChangePassword={() => setShowChangePw(true)} />}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom Nav (8 tab + lucide icon) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur border-t border-white/[0.06] safe-bottom z-50">
        <div className="max-w-6xl mx-auto flex">
          {NAV.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              title={label}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] transition-colors min-w-0 ${
                  isActive ? 'text-accent' : 'text-[#6b7085]'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <span className="truncate w-full text-center px-0.5">{label}</span>
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
              ><XIcon className="w-3.5 h-3.5" /></button>
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

      {showChangePw && (
        <ChangePasswordModal
          onClose={() => setShowChangePw(false)}
          onDone={() => { setShowChangePw(false); setToastMsg('密码已修改'); setTimeout(() => setToastMsg(''), 2500); }}
        />
      )}

      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-medium z-[150] shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// 保护路由：未登录跳 /login
function RequireAuth({ children }) {
  const location = useLocation();
  if (!auth.isLoggedIn()) {
    return <Navigate to={'/login?next=' + encodeURIComponent(location.pathname)} replace />;
  }
  return children;
}

export default function App() {
  const loadAll = useStore(s => s.loadAll);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    // 只有登录后才加载数据
    if (auth.isLoggedIn()) {
      loadAll().finally(() => setBootstrapped(true));
    } else {
      setBootstrapped(true);
    }
  }, []);

  if (!bootstrapped) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-[#6b7085] text-xs">加载中…</div>;
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={
            <RequireAuth>
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
                  {/* v2 · 老路由 alias（保留书签/分享链接可用） */}
                  <Route path="/collection" element={<Navigate to="/monster" replace />} />
                  <Route path="/collection/analytics" element={<Navigate to="/analytics" replace />} />
                  <Route path="/collection/renrigou" element={<Navigate to="/renrigou" replace />} />
                  <Route path="/assets" element={<Navigate to="/warehouse" replace />} />
                  <Route path="/me" element={<Navigate to="/settings" replace />} />
                </Routes>
              </Layout>
            </RequireAuth>
          } />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}