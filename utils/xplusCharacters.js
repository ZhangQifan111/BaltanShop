// 从产品名提取角色核心名

function decodeHTMLEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const DESC_SUFFIXES = ['怪獣', '怪人', '星人', '怪鳥', '恐竜', '怪竜', '獣', '超獣', '珍獣', '大獣',
  '大恐竜', 'ロボット', '宇宙人', '植物', '生物', '生命', '魔ッ子', '原人', '巨人', '大亀',
  '大ダコ', '大蜘蛛', 'エイ', '警備隊長', '忍者', '恐竜'];

function isDescriptor(s) {
  for (const suf of DESC_SUFFIXES) {
    if (s.endsWith(suf)) return true;
  }
  return false;
}

function stripParenVersions(s) {
  // 括号内的二代目是角色身份，不是版本后缀 — 转为 2代目 保留
  s = s.replace(/[（(]\s*二代目\s*[）)]/g, '2代目');
  s = s.replace(/[（(][^）)]*(?:版|Ver\.|カラー|Reborn|リボーン|発光|軟質|限定|ダメージ|激闘|ニューカラー|スチールイメージ|二代目)[^）)]*[）)]/g, '');
  s = s.replace(/[（(][^）)]*[）)]/g, '');
  s = s.replace(/〈[^〉]+〉/g, '');
  s = s.replace(/<[^>]+>/g, '');
  return s;
}

function stripSuffixes(s) {
  // 无空格紧贴后缀（不包含 2代目/二代目 — 那是不同的角色）
  s = s.replace(/(?:塗装済完成品|無塗装ソフビキット|リボーン|Reborn|Ver\.?\s*\d*|Vol\.\s*\d+|ダメージVer\.?|バトルダメージVer\.?|発光Ver\.?)$/, '');
  s = s.replace(/[\s　]+(?:塗装済完成品|無塗装ソフビキット)$/, '');
  s = s.replace(/[\s　]+(?:少年リック限定(?:商品|版|販売|販売版)?)$/, '');
  s = s.replace(/[\s　]+(?:夕焼け塗装|バトルダメージ|ダメージ|発光|ナイトカラー|スタンディング|登場|ブロンズイメージ|シルバーイメージ)(?:Ver\.|ポーズ|版|発光(?:Ver\.|版)?)?$/, '');
  s = s.replace(/[\s　]+(?:Ver\.?(?:\s*\d+)?)$/, '');
  s = s.replace(/[\s　]+(?:総天然色版|総天然色|限定咆哮Ver\.|発光ギミック内蔵|スタチュー|軟質版|ニューカラー版|レトロカラー)$/, '');
  s = s.replace(/[\s　]+(?:セット\)?|開催記念.*|WF\d{4}.*|ＷＦ\d{4}.*|WF限定.*|円谷プロ.*)$/, '');
  s = s.replace(/[\s　]+(?:激闘.*|限定.*|夕焼け.*|ニューカラー.*|ダメージVer\.|バトルダメージVer\.|発光Ver\.)$/, '');
  s = s.replace(/[\s　]+(?:リボーン|Reborn)$/, '');
  s = s.replace(/[\s　]+Vol\.\s*\d+$/, '');
  s = s.replace(/[\s　]*■.*■$/, '');
  s = s.replace(/[\s　]+フェニックスブレイブ$/, '');
  s = s.replace(/[\s　]+バーニングブレイブ$/, '');
  s = s.replace(/[\s　]+メビウスブレイブ$/, '');
  // 年份限定版后缀
  s = s.replace(/[\s　]+\d{4}東京トイフェスティバル限定版$/, '');
  s = s.replace(/[\s　]+\d{4}.*限定版$/, '');
  return s;
}

function stripYear(s) {
  s = s.replace(/[\s　]*[(（]\d{4}(?:年版?)?[)）]$/, '');
  s = s.replace(/(\D)\d{4}(?:年版?)?$/g, '$1');
  return s;
}

function stripTrailingNumber(s) {
  // 只去掉末尾独立的1位数字（如 ガラモン2 → ガラモン），保留 80、1933 等多位数字
  return s.replace(/(\D)\d$/, '$1');
}

function stripSeriesPrefix(s) {
  s = s.replace(/^(?:大怪獣シリーズ|東宝大怪獣シリーズ|東宝大怪獣リーズ|東宝30cmシリーズ|大映30cmシリーズ)[\s　]*/, '');
  s = s.replace(/^(?:大怪獣シリーズ[\s　]*)?(?:ULTRA NEW GENERATION|大映特撮編|帰ってきたウルトラマン編|ウルトラセブン編|ウルトラマンA(?!タイプ)|ウルトラQ|ウルトラ銀河伝説編|ピープロヒーローズ|リアル・マスター・コレクション|キャストキットシリーズ)[\s　]*/, '');
  s = s.replace(/^(?:RMC|リアルマスターコレクション|リアル・マスター・コレクション)[\s　]*/, '');
  s = s.replace(/^(?:WF\d{4}[春夏冬]|WF限定)[\s　]*/, '');
  s = s.replace(/^ＷＦ\d{4}[春夏冬][\s　]*(?:開催記念[\s　]*)?/, '');
  s = s.replace(/^ワンフェス\d{4}[春夏冬]限定[\s　]*/, '');
  s = s.replace(/^2008ワンダーフェスティバル[春夏冬]限定[\s　]*/, '');
  s = s.replace(/^ピープロヒーローズ[\s　]*/, '');
  s = s.replace(/^プロジェクト/, '');
  return s;
}

function stripDescriptors(s) {
  for (const suf of DESC_SUFFIXES) {
    const re = new RegExp(`^([^\\s]{1,6}${suf})[\\s\\u3000]*`);
    const m = s.match(re);
    if (!m) continue;
    // Don't strip if the rest would be empty or just punctuation/parens
    const rest = s.substring(m[1].length).replace(/^[\s　]+/, '');
    if (!rest || rest.length <= 1 || /^[（(〈<].*$/.test(rest)) continue;
    s = rest;
  }
  return s;
}

// 「」内文字：如果格式是 [描述词] + [角色名]，取角色名
function simplifyBracketContent(s) {
  const parts = s.split(/[\s　]+/);
  // 括号内只有单个词 → 保持完整（如 バルタン星人Jr.、バルタン星人円盤 等）
  if (parts.length === 1) return s;
  if (parts.length === 2) {
    if (isDescriptor(parts[0])) {
      // 描述词长度 >= 4 → 真实描述词，取第二部分（豪力怪獣 アロン → アロン）
      if (parts[0].length >= 4 && !isDescriptor(parts[1])) return parts[1];
      // 短描述词（2-3字）→ 更像是角色名的一部分（快獣 ブースカ → 保持完整）
      return s;
    }
    // 第一部分包含在第二部分中 → 取第一部分（ガメラ 大怪獣ガメラ → ガメラ）
    if (parts[1].includes(parts[0]) && parts[1].length > parts[0].length) return parts[0];
  }
  if (parts.length >= 3) {
    const nonDesc = parts.filter(p => !isDescriptor(p) && p.length > 1);
    if (nonDesc.length === 1) return nonDesc[0];
    if (nonDesc.length >= 2) return nonDesc[0];
  }
  return stripDescriptors(s);
}

// ======= 主函数 =======
function extractCharacter(productName) {
  if (!productName) return null;
  let name = decodeHTMLEntities(productName);

  const bracketMatch = name.match(/「([^」]+)」/);
  if (bracketMatch) {
    name = bracketMatch[1];
    name = stripParenVersions(name);
    name = name.trim();
    name = simplifyBracketContent(name);
    name = name.trim();
    name = stripSuffixes(name);
    name = name.trim();
    name = stripYear(name);
  } else {
    name = stripSeriesPrefix(name);
    name = stripDescriptors(name);
    name = stripParenVersions(name);
    name = name.trim();
    name = stripSuffixes(name);
    name = name.trim();
    name = stripYear(name);
    name = stripTrailingNumber(name);
  }

  name = name.replace(/[\/／]/g, '');
  name = name.replace(/[\s　]+/g, ' ');
  name = name.replace(/^[：:。、，,.\s]+/, '');
  name = name.replace(/[：:。、，,\s]+$/, '');  // 保留 Jr. 的句号
  name = name.trim();
  // 去掉 CJK 与 ASCII 之间的空格（ウルトラマン Cタイプ → ウルトラマンCタイプ）
  name = name.replace(/([぀-鿿　-〿＀-￯])\s+([A-Za-z0-9])/g, '$1$2');
  // にせ/ニセ 统一为 にせ（同一角色）
  name = name.replace(/^ニセ/, 'にせ');
  // 组合套装：取 & 前面作为主角色（にせウルトラマン＆ザラブ星人... → にせウルトラマン）
  name = name.replace(/＆.+$/, '');

  if (!name || name.length <= 1) return null;
  return name;
}

function fillCharacters(items) {
  return items.map(item => {
    let charName = extractCharacter(item.product_name);
    if (!charName) charName = item.series_name_ja || item.ref_id;
    return { ...item, character_name: charName };
  });
}

module.exports = { extractCharacter, fillCharacters };
