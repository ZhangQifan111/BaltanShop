/**
 * 拼音搜索 — "懒得切中文"模式
 *
 * 用法：
 *   import { findMatchesByPinyin } from '../lib/pinyin';
 *   findMatchesByPinyin('gongniu', ['公牛社', '公牛魂', '软胶道'])  // → ['公牛社', '公牛魂']
 *   findMatchesByPinyin('gn',     ['公牛社', '软胶道'])           // → ['公牛社']
 *
 * 基于 pinyin-pro 全量字典（覆盖所有常用汉字），非汉字字符原样保留。
 * 接口与旧手写字典版完全一致，调用方无需改动。
 */
import { pinyin } from 'pinyin-pro';

// 获取字符串的拼音首字母（"公牛社" → "gns"）
export function getInitials(str) {
  if (!str) return '';
  return pinyin(str, { pattern: 'first', toneType: 'none', type: 'array' })
    .map(s => s.toLowerCase())
    .join('');
}

// 获取字符串的全拼（"公牛社" → "gongniushe"）
export function getPinyin(str) {
  if (!str) return '';
  return pinyin(str, { toneType: 'none', type: 'array' })
    .map(s => s.toLowerCase())
    .join('');
}

/**
 * 当搜索词是纯字母时，从 haystacks 里找出可能被它对应的中文词条
 * - 输入 "gongniu" → 匹配 "公牛" 开头的全拼
 * - 输入 "gn"     → 匹配首字母 "gn" 开头的（如公牛社 / 公牛魂）
 * - 输入 "gns"    → 匹配首字母 "gns"（公牛社）
 *
 * @param {string} needle 用户输入的搜索词（应是小写纯字母）
 * @param {string[]} haystacks 候选中文文本数组
 * @returns {string[]} 命中的中文文本
 */
export function findMatchesByPinyin(needle, haystacks) {
  if (!needle || !/^[a-z]+$/.test(needle)) return [];
  const n = needle.toLowerCase();
  const matches = [];
  for (const h of haystacks) {
    if (!h) continue;
    const init = getInitials(h).toLowerCase();
    const full = getPinyin(h).toLowerCase();
    // 四种命中方式：
    // 1. 全拼前缀（gongniu → 公牛*）
    // 2. 全拼包含
    // 3. 首字母前缀（gn → 公牛*）
    // 4. 首字母包含
    if (full.startsWith(n) || full.includes(n) || init.startsWith(n) || init.includes(n)) {
      matches.push(h);
    }
  }
  return matches;
}
