import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/api';

// 单用户场景：用户名写死，只让用户填密码
const USERNAME = 'Baltan';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('请输入密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await auth.login(USERNAME, password);
      navigate(next);
    } catch (e) {
      setError(e.message || '登录失败');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg text-[#d0d4e8] font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-accent mb-1">🛸 秘密基地</h1>
          <p className="text-xs text-[#6b7085]">请输入密码进入</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] rounded-lg">
            <span className="text-lg">👤</span>
            <span className="text-sm font-bold text-white">{USERNAME}</span>
            <span className="text-[10px] text-[#6b7085] ml-auto">单用户模式</span>
          </div>
          <div>
            <label className="text-[10px] text-[#6b7085] block mb-1">密码</label>
            <input
              className="input w-full"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="text-[10px] text-[#6b7085] text-center mt-4">
          v2.0 · 秘密基地
        </p>
      </div>
    </div>
  );
}