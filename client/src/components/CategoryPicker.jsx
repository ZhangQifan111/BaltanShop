/*
 * 层级品类选择器：两个 select 联动
 *
 * value: 当前选中的品类名（顶级或二级都存 name）
 * onChange: (name) => void
 *
 * 交互：
 * - 第一个 select：顶级分类（parent_id=null）
 * - 第二个 select：选中顶级后才启用，列出其下二级
 * - 第二个 select 可选 "— 用顶级：X —" 表示只用顶级
 * - 任意时刻 value 为顶级名时，第二个 select 高亮 "用顶级" 选项
 */
export default function CategoryPicker({ value, onChange, categories = [], className = '' }) {
  const topLevel = categories.filter(c => !c.parent_id);
  const current = categories.find(c => c.name === value);

  // 当前顶级是谁
  const currentTopName = current
    ? (current.parent_id ? topLevel.find(t => t.id === current.parent_id)?.name : current.name)
    : '';

  // 当前顶级下的二级
  const currentTopNode = topLevel.find(t => t.name === currentTopName);
  const children = currentTopNode
    ? categories.filter(c => c.parent_id === currentTopNode.id)
    : [];

  // 当前 value 是顶级还是二级
  const isCurrentTop = current && !current.parent_id;

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <select
        className="input text-xs"
        value={currentTopName}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">(不分类)</option>
        {topLevel.map(c => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      <select
        className="input text-xs"
        value={isCurrentTop ? current.name : value}
        disabled={!currentTopName}
        onChange={e => onChange(e.target.value)}
      >
        {!currentTopName && <option value="">(先选顶级分类)</option>}
        {currentTopName && children.length === 0 && (
          <option value={currentTopName}>{currentTopName}（无子分类）</option>
        )}
        {currentTopName && children.length > 0 && (
          <>
            <option value={currentTopName}>— 用顶级：{currentTopName} —</option>
            {children.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
