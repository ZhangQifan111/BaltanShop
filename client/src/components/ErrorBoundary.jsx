import { Component } from 'react';

/**
 * 防止某个子组件抛错导致整个页面黑屏
 * 出错时显示简单红色提示，而不是空白
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info);
  }
  handleReload = () => {
    // 清掉 token + reload，避免缓存旧 store
    try { localStorage.removeItem('token'); } catch {}
    location.href = '/login';
  };
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-bg text-[#d0d4e8] font-mono flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <div className="text-3xl">💥</div>
            <div className="text-base font-bold text-red-300">页面渲染出错</div>
            <div className="text-xs text-[#8b90a5] break-all">{String(this.state.error?.message || this.state.error)}</div>
            <button className="btn-primary" onClick={this.handleReload}>重新登录</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
