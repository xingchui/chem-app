import { parseEquation, normCond, type ParsedEquation, type Term } from './parse'

/**
 * 判定引擎 — 用户输入 vs 标准答案
 *
 * 判定维度：物质数量/化学式/系数归一/状态/↑↓/电荷/箭头/条件/原子守恒/电荷守恒
 */

export interface TermCheck {
  side: 'reactants' | 'products'
  index: number
  refFormula: string
  userFormula: string
  formulaOk: boolean
  coefficientOk: boolean
  stateOk: boolean
  chargeOk: boolean
  gasOk: boolean
  pptOk: boolean
}

export interface ElementBalance {
  element: string
  refReactants: number
  refProducts: number
  userReactants: number
  userProducts: number
  /** n 聚合部分（聚合物基团 / n 系数项记入此处）；无聚合项时为 0 */
  refReactantsN?: number
  refProductsN?: number
  userReactantsN?: number
  userProductsN?: number
  ok: boolean
}

export interface Judgement {
  correct: boolean
  arrowOk: boolean
  condOk: boolean
  termChecks: TermCheck[]
  balance: ElementBalance[]
  messages: string[]
}

/** 整侧元素总量（含系数）。返回常数部分与 n 聚合部分：
 *  系数含 n（nCH2=CH2、3nHNO3）的项全部记入 n 部分；
 *  n 下标基团（[-CH2-CH2-]n、(C6H10O5)n）记入 n 部分；
 *  其余记入常数部分 */
function sideTotals(terms: Term[]): { const: Record<string, number>; n: Record<string, number> } {
  const c: Record<string, number> = {}
  const n: Record<string, number> = {}
  for (const t of terms) {
    for (const [el, num] of Object.entries(t.atoms)) {
      const add = num * t.coefficient
      if (t.coeffN) n[el] = (n[el] ?? 0) + add
      else c[el] = (c[el] ?? 0) + add
    }
    if (t.nAtoms) {
      for (const [el, num] of Object.entries(t.nAtoms)) {
        n[el] = (n[el] ?? 0) + num * t.coefficient
      }
    }
  }
  return { const: c, n }
}

/** 是否含 n 聚合项（n 系数或 n 下标基团） */
function hasNTerms(terms: Term[]): boolean {
  return terms.some(t => t.coeffN || (t.nAtoms !== undefined && Object.keys(t.nAtoms).length > 0))
}

/** 整侧电荷总量（含系数）；无带电项返回 null */
function sideCharge(terms: Term[]): number | null {
  let total = 0
  let any = false
  for (const t of terms) {
    if (t.charge !== 0) {
      total += t.charge * t.coefficient
      any = true
    }
  }
  return any ? total : null
}

/** 元素取并集 */
function unionKeys(...maps: Record<string, number>[]): string[] {
  const set = new Set<string>()
  for (const m of maps) for (const k of Object.keys(m)) set.add(k)
  return [...set].sort()
}

/** 两化学式的原子组成是否完全一致 */
function sameAtoms(a: Record<string, number>, b: Record<string, number>): boolean {
  return unionKeys(a, b).every(k => (a[k] ?? 0) === (b[k] ?? 0))
}

/** 大写字母序列（去下标数字与小写字母，保留键符），用于判断是否结构简式 */
function uppercaseSeq(f: string): string {
  return f.replace(/[a-z]/g, '').replace(/\d/g, '')
}

/**
 * 重原子骨架：非氢元素按下标展开，保留键符（= ≡ #）与括号（支链标识），忽略单键 '-' 与氢。
 * 用于结构简式之间的等价比较：
 *  - 简写与展开等价：C2H5 → "CC" ≡ CH3CH2 / CH2CH3 → "CC"
 *  - 官能团位置区分：乙醇 "CCO" ≠ 二甲醚 "COC"
 *  - 支链区分：正丁烷 "CCCC" ≠ 异丁烷 "(CC)CC"
 */
function backboneSeq(f: string): string {
  let out = ''
  let i = 0
  while (i < f.length) {
    const ch = f[i]!
    if (ch === '=' || ch === '≡' || ch === '#' || ch === '(' || ch === ')') {
      out += ch
      i++
      continue
    }
    // 聚合方括号归一为圆括号：[-CH2-CH2-]n ≡ (CH2CH2)n
    if (ch === '[') {
      out += '('
      i++
      continue
    }
    if (ch === ']') {
      out += ')'
      i++
      continue
    }
    if (/[A-Z]/.test(ch)) {
      let el = ch
      i++
      if (i < f.length && /[a-z]/.test(f[i]!)) {
        el += f[i]
        i++
      }
      let n = 1
      let digits = ''
      while (i < f.length && /\d/.test(f[i]!)) {
        digits += f[i]
        i++
      }
      if (digits) n = parseInt(digits, 10)
      if (el !== 'H') out += el.repeat(n)
      continue
    }
    i++
  }
  return out
}

/**
 * 是否结构简式：含键符（- = ≡ #），或大写序列中出现 ≥2 个 C
 * （如 CH3CH2OH 有 2 个碳；C2H5OH / C2H6O 是分子式风格，C 只出现 1 次）
 */
function isStructuralFormula(f: string): boolean {
  if (/[-=\u2261#]/.test(f)) return true
  return (uppercaseSeq(f).match(/C/g) ?? []).length >= 2
}

/**
 * 化学式等价判定：
 *  1) 字符串相等
 *  2) 含碳物质原子组成+电荷相等：
 *     - 双方都是结构简式 → 比较重原子骨架（拒同分异构体，CH3OCH3 ≠ 乙醇；简写/展开等价，C2H5 ≡ CH2CH3）
 *     - 至少一方是分子式风格 → 原子组成等价即可（C2H5OH ≡ CH3CH2OH ≡ C2H6O）
 *  无机物（不含 C）保持严格字符串匹配
 */
function formulaEquivalent(u: Term, r: Term): boolean {
  if (u.formula === r.formula) return true
  if (!u.formula.includes('C') || !r.formula.includes('C')) return false
  if (u.charge !== r.charge) return false
  if (!sameAtoms(u.atoms, r.atoms)) return false
  // n 下标基团须一致（[-CH2-CH2-]n ≡ (CH2CH2)n；但 ≠ nCH2=CH2 单体）
  if (!sameAtoms(u.nAtoms ?? {}, r.nAtoms ?? {})) return false
  const uStruct = isStructuralFormula(u.formula)
  const rStruct = isStructuralFormula(r.formula)
  if (uStruct && rStruct) return backboneSeq(u.formula) === backboneSeq(r.formula)
  return true
}

/** 条件集合：按 + 拆分并逐项归一化（如「浓硫酸+加热」「加热+浓硫酸」→ ['加热','浓硫酸']） */
function condSet(above: string | undefined, below: string | undefined): string[] {
  const out: string[] = []
  for (const s of [above, below]) {
    if (!s) continue
    for (const part of s.split('+')) {
      const norm = normCond(part.trim())
      if (norm) out.push(norm)
    }
  }
  return out.sort()
}

/** 逐侧匹配：ref 每项在 user 侧找化学式等价的项（顺序无关），返回匹配对与两侧剩余项 */
function matchTerms(
  refTerms: Term[],
  userTerms: Term[],
): { pairs: { u: Term; r: Term; index: number }[]; unmatchedRef: { t: Term; index: number }[]; unmatchedUser: Term[] } {
  const used = new Set<number>()
  const pairs: { u: Term; r: Term; index: number }[] = []
  const unmatchedRef: { t: Term; index: number }[] = []
  for (let ri = 0; ri < refTerms.length; ri++) {
    const r = refTerms[ri]!
    let found = -1
    for (let ui = 0; ui < userTerms.length; ui++) {
      if (used.has(ui)) continue
      if (formulaEquivalent(userTerms[ui]!, r)) {
        found = ui
        break
      }
    }
    if (found >= 0) {
      used.add(found)
      pairs.push({ u: userTerms[found]!, r, index: ri })
    } else {
      unmatchedRef.push({ t: r, index: ri })
    }
  }
  const unmatchedUser = userTerms.filter((_, i) => !used.has(i))
  return { pairs, unmatchedRef, unmatchedUser }
}

export function judge(userSrc: string, refSrc: string): Judgement {
  const user = parseEquation(userSrc)
  const ref = parseEquation(refSrc)
  return judgeParsed(user, ref)
}

export function judgeParsed(user: ParsedEquation, ref: ParsedEquation): Judgement {
  const messages: string[] = []
  const termChecks: TermCheck[] = []

  // ── 箭头：'=' 与 '→' 等价；'⇌' 必须严格匹配 ──
  const arrowOk =
    (ref.arrow === '⇌' && user.arrow === '⇌') ||
    (ref.arrow !== '⇌' && user.arrow !== '⇌')
  if (!arrowOk) messages.push(`箭头应为「${ref.arrow}」，你写的是「${user.arrow}」`)

  // ── 条件（集合比较：顺序/上下位置无关，+ 分隔） ──
  const refConds = condSet(ref.condAbove, ref.condBelow)
  const userConds = condSet(user.condAbove, user.condBelow)
  const condOk = refConds.length === userConds.length && refConds.every((c, i) => c === userConds[i])
  if (!condOk) {
    messages.push(`反应条件应为「${refConds.join(' + ') || '无'}」，你写的是「${userConds.join(' + ') || '无'}」`)
  }

  // ── 逐侧逐项对比（顺序无关：按化学式等价匹配，而非按位置） ──
  const pairsBySide: { reactants: { u: Term; r: Term; index: number }[]; products: { u: Term; r: Term; index: number }[] } = {
    reactants: [],
    products: [],
  }
  for (const side of ['reactants', 'products'] as const) {
    const ut = user[side]
    const rt = ref[side]
    if (ut.length !== rt.length) {
      messages.push(`生成物/反应物数量不符：${side === 'reactants' ? '反应物' : '生成物'}应为 ${rt.length} 项，你写了 ${ut.length} 项`)
    }
    const { pairs, unmatchedRef, unmatchedUser } = matchTerms(rt, ut)
    pairsBySide[side] = pairs
    // 化学式等价的匹配对：检查状态/电荷/↑↓
    for (const { u, r, index } of pairs) {
      const stateOk = u.state === r.state
      const chargeOk = u.charge === r.charge
      const gasOk = u.gas === r.gas
      const pptOk = u.ppt === r.ppt
      if (!stateOk) messages.push(`「${u.formula}」状态符号应为「${r.state ?? '无'}」，你写的是「${u.state ?? '无'}」`)
      if (!chargeOk) messages.push(`「${u.formula}」电荷应为 ${r.charge}，你写的是 ${u.charge}`)
      if (!gasOk) messages.push(`「${u.formula}」${r.gas ? '应标 ↑' : '不应标 ↑'}`)
      if (!pptOk) messages.push(`「${u.formula}」${r.ppt ? '应标 ↓' : '不应标 ↓'}`)
      termChecks.push({ side, index, refFormula: r.formula, userFormula: u.formula, formulaOk: true, coefficientOk: false, stateOk, chargeOk, gasOk, pptOk })
    }
    if (unmatchedRef.length > 0 && unmatchedRef.length === unmatchedUser.length) {
      // 化学式不等价且两侧数量相等：按序配对报告「应为 X」
      unmatchedRef.forEach(({ t: r, index }, i) => {
        const u = unmatchedUser[i]!
        const stateOk = u.state === r.state
        const chargeOk = u.charge === r.charge
        const gasOk = u.gas === r.gas
        const pptOk = u.ppt === r.ppt
        messages.push(`${side === 'reactants' ? '反应物' : '生成物'}第 ${index + 1} 项化学式应为「${r.formula}」，你写的是「${u.formula}」`)
        if (!stateOk) messages.push(`「${u.formula}」状态符号应为「${r.state ?? '无'}」，你写的是「${u.state ?? '无'}」`)
        if (!chargeOk) messages.push(`「${u.formula}」电荷应为 ${r.charge}，你写的是 ${u.charge}`)
        if (!gasOk) messages.push(`「${u.formula}」${r.gas ? '应标 ↑' : '不应标 ↑'}`)
        if (!pptOk) messages.push(`「${u.formula}」${r.ppt ? '应标 ↓' : '不应标 ↓'}`)
        termChecks.push({ side, index, refFormula: r.formula, userFormula: u.formula, formulaOk: false, coefficientOk: false, stateOk, chargeOk, gasOk, pptOk })
      })
    } else if (unmatchedUser.length > 0) {
      // 用户多写的项
      for (let k = 0; k < unmatchedUser.length; k++) {
        const u = unmatchedUser[k]!
        messages.push(`${side === 'reactants' ? '反应物' : '生成物'}多写了「${u.formula}」`)
        termChecks.push({ side, index: rt.length + k, refFormula: '', userFormula: u.formula, formulaOk: false, coefficientOk: false, stateOk: false, chargeOk: false, gasOk: false, pptOk: false })
      }
    }
  }

  // ── 系数归一对比（基于匹配对系数比值，顺序无关） ──
  const allPairs = [...pairsBySide.reactants, ...pairsBySide.products]
  const ratios = allPairs.map(p => p.u.coefficient / p.r.coefficient)
  let allCoeffOk = ratios.length === 0 || ratios.every(v => Math.abs(v - ratios[0]!) < 1e-6)
  if (!allCoeffOk) {
    // 逐项定位：找第一个比值偏离基准的匹配对
    const base = ratios[0]!
    const idx = ratios.findIndex((v, i) => i > 0 && Math.abs(v - base) > 1e-6)
    if (idx >= 0) {
      const pair = allPairs[idx]!
      const want = pair.r.coefficient * base
      messages.push(`「${pair.r.formula}」系数不正确（应为 ${fmt(want)}，你的是 ${fmt(pair.u.coefficient)}）`)
    } else {
      allCoeffOk = true
    }
  }
  // 回填系数判定（化学式错误的项系数也算错误）
  for (const c of termChecks) {
    c.coefficientOk = c.formulaOk && allCoeffOk
  }
  if (!allCoeffOk && !messages.some(m => m.includes('系数不正确'))) {
    messages.push('系数比例不正确')
  }

  // ── 原子守恒诊断（用户方程自身 + 与参考答案对比；n 聚合部分单独比对） ──
  const userR = sideTotals(user.reactants)
  const userP = sideTotals(user.products)
  const refR = sideTotals(ref.reactants)
  const refP = sideTotals(ref.products)
  const balance: ElementBalance[] = []
  for (const el of unionKeys(userR.const, userP.const, refR.const, refP.const, userR.n, userP.n, refR.n, refP.n)) {
    const uR = userR.const[el] ?? 0
    const uP = userP.const[el] ?? 0
    const rR = refR.const[el] ?? 0
    const rP = refP.const[el] ?? 0
    const uRn = userR.n[el] ?? 0
    const uPn = userP.n[el] ?? 0
    const rRn = refR.n[el] ?? 0
    const rPn = refP.n[el] ?? 0
    const constOk = Math.abs(uR - uP) < 1e-6 && Math.abs(rR - rP) < 1e-6
    const nOk = Math.abs(uRn - uPn) < 1e-6 && Math.abs(rRn - rPn) < 1e-6
    balance.push({
      element: el,
      refReactants: rR,
      refProducts: rP,
      userReactants: uR,
      userProducts: uP,
      refReactantsN: rRn,
      refProductsN: rPn,
      userReactantsN: uRn,
      userProductsN: uPn,
      ok: constOk && nOk,
    })
    if (Math.abs(uR - uP) >= 1e-6) {
      messages.push(`元素 ${el} 不守恒（反应物 ${fmt(uR)}，生成物 ${fmt(uP)}）`)
    }
    if (Math.abs(uRn - uPn) >= 1e-6) {
      messages.push(`元素 ${el} 不守恒（n 系数：反应物 n×${fmt(uRn)}，生成物 n×${fmt(uPn)}）`)
    }
  }

  // ── 电荷守恒诊断（含 n 聚合项时不校验：n 为符号量） ──
  const anyN = hasNTerms([...user.reactants, ...user.products])
  const uq = anyN ? null : sideCharge(user.reactants)
  const up = anyN ? null : sideCharge(user.products)
  if (uq !== null && up !== null && Math.abs(uq - up) >= 1e-6) {
    messages.push(`电荷不守恒（反应物 ${fmt(uq)}，生成物 ${fmt(up)}）`)
  }

  const chargeBalanced = uq === null || up === null || Math.abs(uq - up) < 1e-6

  const correct =
    arrowOk &&
    condOk &&
    allCoeffOk &&
    termChecks.every(t => t.formulaOk && t.coefficientOk && t.stateOk && t.chargeOk && t.gasOk && t.pptOk) &&
    balance.every(b => b.ok) &&
    chargeBalanced

  return { correct, arrowOk, condOk, termChecks, balance, messages }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}
