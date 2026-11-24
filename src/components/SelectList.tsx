export interface SelectItem {
  key: string
  title: string
  meta: string
  onClick: () => void
}

interface SelectListProps {
  items: readonly SelectItem[]
}

/** 教材/章/节共用的三级选择列表 */
export function SelectList({ items }: SelectListProps) {
  return (
    <div className="select-list">
      {items.map(item => (
        <button key={item.key} type="button" className="select-item" onClick={item.onClick}>
          <div className="select-item-text">
            <span className="select-item-title">{item.title}</span>
            <span className="select-item-meta">{item.meta}</span>
          </div>
          <span className="select-item-arrow">→</span>
        </button>
      ))}
    </div>
  )
}
