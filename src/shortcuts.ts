/** 快捷符号栏与 Ctrl+数字 映射 */

export interface ShortcutSymbol {
  sym: string
  label: string
}

export const SHORTCUT_SYMBOLS: ShortcutSymbol[] = [
  { sym: '↑', label: '气体' },
  { sym: '↓', label: '沉淀' },
  { sym: '=', label: '等号' },
  { sym: '⇌', label: '可逆' },
  { sym: '≡', label: '三键' },
  { sym: '△', label: '加热' },
  { sym: '₂', label: '下标' },
  { sym: '⁺', label: '正电荷' },
  { sym: '⁻', label: '负电荷' },
  { sym: '℃', label: '温度' },
]

export const CTRL_MAP: Record<string, string> = {
  '1': '↑',
  '2': '↓',
  '3': '=',
  '4': '⇌',
  '5': '≡',
  '6': '△',
  '7': '₂',
  '8': '⁺',
  '9': '⁻',
  '0': '℃',
}
