import type { ParsedEquation, Term } from './parse'

/**
 * 规范式 → LaTeX（KaTeX 可渲染）
 *
 * 用于 UI 实时预览、题目卡显示。纯函数，无副作用。
 */

/** 化学式 → LaTeX（下标/键/电荷/聚合基团） */
export function formulaToLatex(formula: string, charge = 0): string {
  if (formula === 'e^-') return 'e^-'
  let s = formula
  // 下标：元素符号或右括号/方括号后的数字
  s = s.replace(/([A-Za-z]|\)|\])(\d+)/g, '$1_{$2}')
  // 聚合度 n 下标（(C6H10O5)n、[-CH2-CH2-]n）
  s = s.replace(/(\)|\])n/g, '$1_{n}')
  // 键
  s = s.replace(/≡/g, '\\equiv ')
  s = s.replace(/#/g, '\\#')
  if (charge !== 0) {
    const mag = Math.abs(charge)
    const sign = charge > 0 ? '+' : '-'
    s += `^{${mag === 1 ? sign : `${mag}${sign}`}}`
  }
  return s
}

/** 单项 → LaTeX（系数+化学式+状态+↑↓） */
export function termToLatex(t: Term): string {
  const parts: string[] = []
  if (t.coeffN) {
    // 聚合系数：n / 3n
    parts.push(t.coefficient === 1 ? 'n' : `${t.coefficient}n`)
  } else if (t.coefficient !== 1) {
    const c = t.coefficient
    if (Number.isInteger(c)) {
      parts.push(String(c))
    } else {
      // 分数系数：找出分子分母
      const [n, d] = fraction(c)
      parts.push(`\\frac{${n}}{${d}}`)
    }
  }
  let f = formulaToLatex(t.formula, t.charge)
  if (t.state) f += `\\text{(${t.state})}`
  if (t.gas) f += '\\uparrow'
  if (t.ppt) f += '\\downarrow'
  parts.push(f)
  return parts.join('')
}

/** 小数 → 分数（0.5 → 1/2），失败返回 [n,1] */
function fraction(c: number): [number, number] {
  // 尝试分母 2..100 的最近分数
  for (let d = 2; d <= 100; d++) {
    const n = c * d
    if (Math.abs(n - Math.round(n)) < 1e-9) return [Math.round(n), d]
  }
  return [Math.round(c * 100), 100]
}

/** 条件文本 → LaTeX 安全文本 */
function condToLatex(cond?: string): string {
  if (!cond) return ''
  return `\\text{${cond.replace(/\\/g, '\\textbackslash ').replace(/\{/g, '\\{').replace(/\}/g, '\\}')}}`
}

/** 方程式 → LaTeX（含箭头与上下条件） */
export function eqToLatex(eq: ParsedEquation): string {
  const left = eq.reactants.map(termToLatex).join(' + ')
  const right = eq.products.map(termToLatex).join(' + ')
  const above = condToLatex(eq.condAbove)
  const below = condToLatex(eq.condBelow)
  let arrow: string
  switch (eq.arrow) {
    case '⇌':
      arrow = '\\rightleftharpoons'
      break
    case '→':
      arrow = '\\rightarrow'
      break
    default:
      arrow = '='
  }
  if (above || below) {
    // 条件堆叠：\overset{上面}{\underset{下面}{箭头}}
    let stacked = arrow
    if (below) stacked = `\\underset{${below}}{${stacked}}`
    if (above) stacked = `\\overset{${above}}{${stacked}}`
    arrow = stacked
  }
  return `${left} ${arrow} ${right}`
}
