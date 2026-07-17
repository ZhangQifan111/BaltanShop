/** @type {import('tailwindcss').Config} */
// 巴坦杂货铺设计 token v2 — 设计师方案（design-overview-v2）
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 核心色板（与设计稿一致）
        bg: '#0f1117',           // 背景
        surface: '#1a1d27',      // 卡片
        'surface-2': '#222632',  // 嵌套卡
        'surface-hover': '#222632', // hover（兼容老代码）
        accent: '#f0a030',       // 主色（橙）
        'accent-soft': '#f0a03026',  // 10% 透明橙（hover bg）
        border: 'rgba(255,255,255,0.08)',
        muted: '#a0a4b8',        // 次要文字
        'muted-2': '#6b7085',    // 辅助文字
        // 语义色
        emerald: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981' },
        red:     { 300: '#fca5a5', 400: '#f87171' },
        cyan:    { 300: '#67e8f9', 400: '#22d3ee' },
        pink:    { 300: '#f9a8d4' },
      },
      fontFamily: {
        // 数字用 mono（等宽，对齐好看）
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        // 与设计稿 rounded-xl (12px) 一致；xl 默认 12px，无需额外
      },
      spacing: {
        // 与设计稿一致：p-5 = 20px / gap-3 = 12px / gap-2 = 8px
      },
    },
  },
  plugins: [],
};
