/**
 * 拼音字典 — 给搜索做"懒得切中文"模式
 *
 * 用法：
 *   import { findMatchesByPinyin } from '../lib/pinyin';
 *   findMatchesByPinyin('gongniu', ['公牛社', '公牛魂', '软胶道'])  // → ['公牛社', '公牛魂']
 *   findMatchesByPinyin('gn',     ['公牛社', '软胶道'])           // → ['公牛社']
 *
 * 字典覆盖 buy-ledger-v2 用户场景里所有分类名 + 常见词的汉字。
 * 新分类如含未收录汉字，搜不到，但不影响原中文搜索。
 */

// 汉字 → 全拼（小写，无声调）
const PINYIN_FULL = {
  公: 'gong', 牛: 'niu', 社: 'she', 魂: 'hun',
  软: 'ruan', 胶: 'jiao', 食: 'shi', 玩: 'wan',
  怪: 'guai', 兽: 'shou', 扭: 'niu', 蛋: 'dan',
  掌: 'zhang', 动: 'dong', 指: 'zhi', 套: 'tao',
  卡: 'ka', 片: 'pian', 书: 'shu', 籍: 'ji',
  积: 'ji', 木: 'mu', 钥: 'yao', 匙: 'chi',
  橡: 'xiang', 皮: 'pi', 杂: 'za', 七: 'qi',
  八: 'ba', 名: 'ming', 鉴: 'jian', 戏: 'xi',
  画: 'hua', 壁: 'bi', 虎: 'hu', 大: 'da',
  里: 'li', 对: 'dui', 决: 'jue', 带: 'dai',
  盒: 'he', 乡: 'xiang', 散: 'san', 货: 'huo',
  通: 'tong', 普: 'pu', 其: 'qi', 他: 'ta',
  号: 'hao', 毛: 'mao', 绒: 'rong', 海: 'hai',
  洋: 'yang', 熊: 'xiong', 模: 'mo', 猪: 'zhu',
  花: 'hua', 道: 'dao', 银: 'yin', 河: 'he',
  连: 'lian', 邦: 'bang', 资: 'zi', 料: 'liao',
  奥: 'ao', 特: 'te', 曼: 'man', 圌: 'chui',
  楳: 'mei', 图: 'tu', 雄: 'xiong', 普: 'pu',
  通: 'tong', 乡: 'xiang', 邦: 'bang', 宇: 'yu',
  宙: 'zhou', 哥: 'ge', 莫: 'mo', 拉: 'la',
  杰: 'jie', 克: 'ke', 杜: 'du', 里: 'li',
  安: 'an', 东: 'dong', 蒙: 'meng', 奇: 'qi',
  诺: 'nuo', 亚: 'ya', 麦: 'mai', 泽: 'ze',
  恩: 'en', 卡: 'ka', 乔: 'qiao', 宙: 'zhou',
};

// 获取字符串的拼音首字母（"公牛社" → "gns"）
export function getInitials(str) {
  if (!str) return '';
  return [...str].map(c => {
    if (/[一-龥]/.test(c)) return PINYIN_FULL[c]?.[0] || c;
    return c;
  }).join('');
}

// 获取字符串的全拼（"公牛社" → "gongniushe"）
export function getPinyin(str) {
  if (!str) return '';
  return [...str].map(c => {
    if (/[一-龥]/.test(c)) return PINYIN_FULL[c] || c;
    return c;
  }).join('');
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
    // 三种命中方式：
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
