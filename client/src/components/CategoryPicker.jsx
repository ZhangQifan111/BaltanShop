/*
 * 层级品类选择器：两个 select 联动（Stage 3：value 改用 category_id）
 *
 * value: 当前选中的 category.id（null/undefined/'' = 不选）
 * onChange: (id: number | null) => void
 *
 * 交互：
 * - 第一个 select：顶级分类（parent_id=null）
 * - 第二个 select：选中顶级后才启用，列出其下二级
 * - 第二个 select 可选 "— 用顶级：X —" 表示只用顶级
 */
export default function CategoryPicker({ value, onChange, categories = [], className = '', disabled = false }) {
  const topLevel = categories.filter(c => !c.parent_id);
  const current = categories.find(c => c.id === value);

  // 当前顶级是谁（顶级自身 / 二级 → 反查顶级）
  const currentTopId = current
    ? (current.parent_id || current.id)
    : null;

  // 当前顶级下的二级
  const children = currentTopId != null
    ? categories.filter(c => c.parent_id === currentTopId)
    : [];

  // 当前 value 是顶级还是二级
  const isCurrentTop = current && !current.parent_id;

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <select
        className="input text-xs"
        value={currentTopId ?? ''}
        onChange={e => {
          const id = e.target.value ? Number(e.target.value) : null;
          onChange(id);
        }}
        disabled={disabled}
      >
        <option value="">(不分类)</option>
        {topLevel.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <select
        className="input text-xs"
        value={isCurrentTop ? '' : (value ?? '')}
        disabled={!currentTopId || disabled}
        onChange={e => {
          const v = e.target.value;
          if (v === '__top__') {
            // "— 用顶级 —" 选项：用顶级 id
            onChange(currentTopId);
          } else if (v === '') {
            onChange(null);
          } else {
            onChange(Number(v));
          }
        }}
      >
        {!currentTopId && <option value="">(先选顶级分类)</option>}
        {currentTopId && children.length === 0 && (
          <option value="">{current?.name || ''}（无子分类）</option>
        )}
        {currentTopId && children.length > 0 && (
          <>
            <option value="__top__">— 用顶级：{current?.name} —</option>
            {children.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
