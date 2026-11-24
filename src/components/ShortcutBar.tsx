import { SHORTCUT_SYMBOLS } from '../shortcuts'

interface ShortcutBarProps {
  disabled?: boolean
  onInsert: (sym: string) => void
}

/** 快捷符号栏；判题后禁用，避免改写已提交的答案 */
export function ShortcutBar({ disabled = false, onInsert }: ShortcutBarProps) {
  return (
    <div className="shortcut-bar">
      {SHORTCUT_SYMBOLS.map(item => (
        <button
          key={item.sym}
          type="button"
          className="shortcut-btn"
          title={item.label}
          disabled={disabled}
          onClick={() => onInsert(item.sym)}
        >
          {item.sym}
          <span className="label">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
