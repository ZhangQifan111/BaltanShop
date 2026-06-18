// 来源常量 — 所有组件统一引用
export const SOURCES = [
  '海淘-任你购',
  '海淘-任意门',
  '海淘-乐淘一番',
  '代购-四人帮',
  '代购-W',
  '代购-Z',
  '其他代购',
  '咸鱼',
  'vx好友',
  'direct',
  'proxy',
  'domestic',
  'secondhand',
];

// 来源 → 展示名
export function sourceLabel(s) {
  const m = {
    '海淘-任你购': '海淘·任你购',
    '海淘-任意门': '海淘·任意门',
    '海淘-乐淘一番': '海淘·乐淘一番',
    '代购-四人帮': '代购·四人帮',
    '代购-W': '代购·W',
    '代购-Z': '代购·Z',
    '其他代购': '其他代购',
    '咸鱼': '咸鱼',
    'vx好友': 'vx好友',
    'direct': '直购',
    'proxy': '代购',
    'domestic': '国内',
    'secondhand': '二手',
  };
  return m[s] || s || '';
}

// 来源 → 业务分组（影响成本计算、阶段逻辑等）
export function sourceGroup(s) {
  if (!s) return 'direct';
  if (s === 'direct' || s.startsWith('海淘-')) return 'direct'; // 海淘平台 = 直购
  if (s === 'domestic') return 'domestic';
  if (s === 'secondhand') return 'secondhand';
  return 'proxy'; // 代购系列
}

// --- 两级选择 UI 结构 ---

export const SOURCE_CATEGORIES = [
  {
    key: 'direct', label: '直购', type: 'group',
    items: [
      { key: '任你购', label: '任你购', source: '海淘-任你购' },
      { key: '任意门', label: '任意门', source: '海淘-任意门' },
      { key: '乐淘一番', label: '乐淘一番', source: '海淘-乐淘一番' },
    ],
  },
  {
    key: 'proxy', label: '代购', type: 'group',
    items: [
      { key: '四人帮', label: '四人帮', source: '代购-四人帮' },
      { key: 'W', label: 'W', source: '代购-W' },
      { key: 'Z', label: 'Z', source: '代购-Z' },
      { key: '其他代购', label: '其他', source: '其他代购' },
    ],
  },
  { key: '咸鱼', label: '咸鱼', type: 'simple', source: '咸鱼' },
  { key: 'vx好友', label: 'vx好友', type: 'simple', source: 'vx好友' },
];

// cat item → 最终的 source 值
export function toSourceValue(cat, detailKey) {
  const c = SOURCE_CATEGORIES.find(x => x.key === cat);
  if (!c) return cat;
  if (c.type === 'simple') return c.source;
  const item = c.items.find(x => x.key === detailKey);
  return item ? item.source : c.items[0].source;
}

// 反向：source 值 → { cat, detail }
export function parseSource(s) {
  if (!s) return { cat: 'direct', detail: '任你购' };
  for (const c of SOURCE_CATEGORIES) {
    if (c.type === 'simple' && c.source === s) return { cat: c.key, detail: null };
    if (c.type === 'group') {
      const item = c.items.find(x => x.source === s);
      if (item) return { cat: c.key, detail: item.key };
    }
  }
  // legacy fallback
  if (s === 'direct') return { cat: 'direct', detail: null };
  if (s === 'proxy') return { cat: 'proxy', detail: null };
  if (s === 'domestic') return { cat: 'domestic', detail: null };
  if (s === 'secondhand') return { cat: 'secondhand', detail: null };
  if (s.startsWith('海淘-')) return { cat: 'direct', detail: s.slice(3) };
  if (s.startsWith('代购-')) return { cat: 'proxy', detail: s.slice(3) };
  if (s === '其他代购') return { cat: 'proxy', detail: '其他代购' };
  return { cat: 'direct', detail: '任你购' };
}
