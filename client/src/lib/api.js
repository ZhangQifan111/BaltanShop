const BASE = '/api';

// 白名单：这些路径不要求 token（登录页 + ingest）
const AUTH_WHITELIST = ['/auth/login', '/ingest-renrigou'];

function getToken() {
  try { return localStorage.getItem('token'); } catch { return null; }
}
function setToken(t) {
  try { if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); } catch {}
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  // 自动带 Authorization（白名单除外）
  const isWhitelist = AUTH_WHITELIST.some(w => path.startsWith(w));
  if (!isWhitelist) {
    const token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  }
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (res.status === 401 && !isWhitelist) {
    // token 失效：清掉 + 跳登录页
    setToken(null);
    if (!location.pathname.startsWith('/login')) {
      location.href = '/login?next=' + encodeURIComponent(location.pathname);
    }
    throw new Error('未登录');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};

export const auth = {
  login: async (username, password) => {
    const r = await request('POST', '/auth/login', { username, password });
    if (r.token) setToken(r.token);
    return r;
  },
  logout: () => { setToken(null); location.href = '/login'; },
  me: () => request('GET', '/auth/me'),
  changePassword: (oldPassword, newPassword) =>
    request('POST', '/auth/change-password', { oldPassword, newPassword }),
  isLoggedIn: () => !!getToken(),
};

export default api;