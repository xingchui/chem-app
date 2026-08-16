/**
 * 化学方程式解析器 — 规范式文法（用户输入/数据存储/判定共用）
 *
 * 文法:
 *   Equation    := Side ARROW ('[' Cond ']')* Side
 *   Side        := Term ('+' Term)*
 *   Term        := Coeff? Formula State? ('↑'|'↓')?
 *   Coeff       := Number | Number '/' Number | N | Number N   (e.g. 3, 1/2, n, 3n; N 为聚合系数)
 *   Formula     := (Element Sub? | '(' Formula ')' Sub? | '[' Formula ']' N? | Bond)* Charge?
 *   Element     := [A-Z][a-z]? | 'e' (电子)
 *   Bond        := '-' | '=' | '≡' | '#'   (仅当后随元素或'('时视为键)
 *   Sub         := digits
 *   N           := 'n'（聚合度：系数 n 记入 Term.coeffN；方括号基团 ']n' 记入 Term.nAtoms）
 *   Charge      := '^' (digits? Sign | Sign digits?) | digits Sign   (digits Sign 仅在无'^'时)
 *   State       := '(g)' | '(l)' | '(s)' | '(aq)'
 *   Cond        := 任意文本（条件，如 高温/点燃/催化剂/△）；若 '[...]' 内容可解析为化学式且以键开头或后随 n，则视为聚合基团
 *   ARROW       := '=' | '⇌' | '<=>' | '→' | '->'
 */

export class ParseError extends Error {
  pos?: number
  constructor(message: string, pos?: number) {
    super(message)
    this.name = 'ParseError'
    this.pos = pos
  }
}

export interface Term {
  /** 规范式化学式，如 Fe2O3 / Ca(OH)2 / CH3CH2OH / e^- */
  formula: string
  coefficient: number
  /** 元素计数（化学式基准，不含系数、不含 n 下标基团）；电子不含原子 */
  atoms: Record<string, number>
  /** n 下标基团（聚合度）的符号原子：n·[-CH2-CH2-]n 记入此处 */
  nAtoms?: Record<string, number>
  /** 系数含聚合度 n（如 nCH2=CH2、3nHNO3）：整项乘以 n */
  coeffN: boolean
  /** 电荷（0 = 中性）；电子为 -1 */
  charge: number
  state?: 'g' | 'l' | 's' | 'aq'
  gas: boolean
  ppt: boolean
}

export interface ParsedEquation {
  reactants: Term[]
  products: Term[]
  /** '='（不可逆/完成）| '⇌'（可逆）| '→'（不可逆，与 = 等价） */
  arrow: '=' | '⇌' | '→'
  condAbove?: string
  condBelow?: string
}

const ELEMENTS = new Set([
  'Ac', 'Ag', 'Al', 'Am', 'Ar', 'As', 'At', 'Au', 'B', 'Ba', 'Be', 'Bh', 'Bi', 'Bk',
  'Br', 'C', 'Ca', 'Cd', 'Ce', 'Cf', 'Cl', 'Cm', 'Cn', 'Co', 'Cr', 'Cs', 'Cu', 'Db',
  'Ds', 'Dy', 'Er', 'Es', 'Eu', 'F', 'Fe', 'Fl', 'Fm', 'Fr', 'Ga', 'Gd', 'Ge', 'H',
  'He', 'Hf', 'Hg', 'Ho', 'Hs', 'I', 'In', 'Ir', 'K', 'Kr', 'La', 'Li', 'Lr', 'Lu',
  'Lv', 'Mc', 'Md', 'Mg', 'Mn', 'Mo', 'Mt', 'N', 'Na', 'Nb', 'Nd', 'Ne', 'Nh', 'Ni',
  'No', 'Np', 'O', 'Og', 'Os', 'P', 'Pa', 'Pb', 'Pd', 'Pm', 'Po', 'Pr', 'Pt', 'Pu',
  'Ra', 'Rb', 'Re', 'Rf', 'Rg', 'Rh', 'Rn', 'Ru', 'S', 'Sb', 'Sc', 'Se', 'Sg', 'Si',
  'Sm', 'Sn', 'Sr', 'Ta', 'Tb', 'Tc', 'Te', 'Th', 'Ti', 'Tl', 'Tm', 'Ts', 'U', 'V',
  'W', 'Xe', 'Y', 'Yb', 'Zn', 'Zr',
])

const BOND_CHARS = new Set(['-', '=', '≡', '#'])
const STATE_SET = new Set(['g', 'l', 's', 'aq'])

/**
 * 条件归一化：去空白与标点，统一常见别名
 *  △/Δ → 加热；催化 → 催化剂；光/见光 → 光照；
 *  浓H2SO4 → 浓硫酸；稀H2SO4 → 稀硫酸；浓HNO3 → 浓硝酸；稀HNO3 → 稀硝酸
 */
export function normCond(s: string): string {
  return s
    .replace(/\s+/g, '')
    .replace(/[、，,;；]/g, '')
    .replace(/[△Δ]/g, '加热')
    .replace(/浓H2SO4/g, '浓硫酸')
    .replace(/稀H2SO4/g, '稀硫酸')
    .replace(/浓HNO3/g, '浓硝酸')
    .replace(/稀HNO3/g, '稀硝酸')
    .replace(/^催化$|^Cu$|^铜$/g, '催化剂')
    .replace(/^光$|见光/g, '光照')
}

class Parser {
  private pos = 0
  private src: string
  constructor(src: string) {
    this.src = src
  }

  private error(msg: string): never {
    throw new ParseError(`${msg}（位置 ${this.pos}：「${this.src.slice(this.pos, this.pos + 12)}」）`, this.pos)
  }

  private skipWs(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!)) this.pos++
  }

  private peek(): string {
    return this.src[this.pos] ?? ''
  }

  private atEnd(): boolean {
    return this.pos >= this.src.length
  }

  parse(): ParsedEquation {
    this.skipWs()
    const reactants = this.parseSide()
    this.skipWs()
    const arrow = this.parseArrowWithCond()
    if (!arrow) this.error('缺少反应箭头（= 或 ⇌ 或 →）')
    this.skipWs()
    const products = this.parseSide()
    // 拒绝连续箭头（链式反应）
    this.skipWs()
    if (!this.atEnd()) this.error('暂不支持连续箭头（多步反应链）')
    return {
      reactants,
      products,
      arrow: arrow.arrow,
      condAbove: arrow.condAbove,
      condBelow: arrow.condBelow,
    }
  }

  private parseSide(): Term[] {
    const terms: Term[] = []
    for (;;) {
      this.skipWs()
      const c = this.peek()
      if (this.atEnd()) break
      if (c === '+') {
        this.pos++
        this.skipWs()
        if (this.atEnd() || this.isArrowStart()) this.error('「+」后缺少物质')
        continue
      }
      if (c === '=' || c === '⇌' || c === '→' || c === '<' || (c === '-' && this.src[this.pos + 1] === '>')) break
      // '[' 此时已是聚合基团起点（如 [-CH2-CH2-]n），由 parseFormula 处理
      terms.push(this.parseTerm())
    }
    if (terms.length === 0) this.error('缺少物质')
    return terms
  }

  private isArrowStart(): boolean {
    const c = this.peek()
    if (c === '=' || c === '⇌' || c === '→' || c === '⟶' || c === '<') return true
    return c === '-' && this.src[this.pos + 1] === '>'
  }

  private parseArrowWithCond():
    | { arrow: '=' | '⇌' | '→'; condAbove?: string; condBelow?: string }
    | null {
    this.skipWs()
    const c = this.peek()
    let arrow: '=' | '⇌' | '→' | null = null
    if (c === '=') {
      arrow = '='
      this.pos++
    } else if (c === '⇌') {
      arrow = '⇌'
      this.pos++
    } else if (c === '→' || c === '⟶') {
      arrow = '→'
      this.pos++
    } else if (c === '<' && this.src[this.pos + 1] === '=' && this.src[this.pos + 2] === '>') {
      arrow = '⇌'
      this.pos += 3
    } else if (c === '-' && this.src[this.pos + 1] === '>') {
      arrow = '→'
      this.pos += 2
    }
    if (!arrow) return null
    const conds: string[] = []
    for (let i = 0; i < 2; i++) {
      this.skipWs()
      if (this.peek() !== '[') break
      const save = this.pos
      const cond = this.readBracket()
      // 歧义消解：'[...]' 内容若能完整解析为化学式，且以键开头（聚合链）、后随 n（聚合度后缀）、
      // 或后随数字/电荷符号（配合物离子，如 [Cu(NH3)4]2+、[Fe(CN)6]3-），则是公式而非条件。
      // （[MnO2]、[加热] 等条件无键、无 n 后缀，后随空格或另一条件括号）
      const afterBracket = this.src[this.pos] ?? ''
      if (
        this.bracketIsFormula(cond) &&
        (BOND_CHARS.has(cond[0]) || afterBracket === 'n' || /\d/.test(afterBracket) || /[+-]/.test(afterBracket))
      ) {
        this.pos = save
        break
      }
      if (cond.length > 0) conds.push(normCond(cond))
    }
    return { arrow, condAbove: conds[0], condBelow: conds[1] }
  }

  /** 判断方括号内容是否为一个完整化学式（用于条件/聚合基团歧义消解） */
  private bracketIsFormula(content: string): boolean {
    try {
      const p = new Parser(content)
      p.parseFormula()
      p.skipWs()
      return p.atEnd()
    } catch {
      return false
    }
  }

  /**
   * 歧义总判据：方括号是聚合基团（留在产物侧）当且仅当
   *   bracketIsFormula(内容) 且（以键开头 或 后随 n）。
   * 键开头覆盖 [-CH2-CH2-]n 类；后随 n 覆盖 [C6H7O2(ONO2)3]n 类；
   * [MnO2]、[加热] 等条件两者皆无，落回条件解析。
   */

  private readBracket(): string {
    // 当前字符为 '['
    this.pos++
    let out = ''
    while (!this.atEnd() && this.peek() !== ']') {
      out += this.src[this.pos]
      this.pos++
    }
    if (this.atEnd()) this.error('条件括号未闭合')
    this.pos++ // 跳过 ]
    return out
  }

  private parseTerm(): Term {
    const { value: coefficient, coeffN } = this.parseCoefficient()
    const { formula, atoms, nAtoms, charge, state, gas, ppt } = this.parseFormula()
    return { formula, coefficient, atoms, nAtoms, coeffN, charge, state, gas, ppt }
  }

  /**
   * 系数：数字 / 分数，或聚合度 n / 数字+n（如 nCH2=CH2、3nHNO3）。
   * 仅在后随化学式开头（大写元素/(/[）时识别为 n 系数，避免误吞 N2、NaCl 等。
   */
  private parseCoefficient(): { value: number; coeffN: boolean } {
    this.skipWs()
    const rest = this.src.slice(this.pos)
    const nForm = /^(?:\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)?n(?=[A-Z(e[])/.exec(rest)
    if (nForm) {
      this.pos += nForm[0].length
      const text = nForm[0].slice(0, -1) // 去掉末尾的 n
      if (!text) return { value: 1, coeffN: true }
      if (text.includes('/')) {
        const [num, den] = text.split('/')
        const d = parseFloat(den!)
        if (d === 0) this.error('分母不能为 0')
        return { value: parseFloat(num!) / d, coeffN: true }
      }
      return { value: parseFloat(text), coeffN: true }
    }
    const m = /^\d+(\.\d+)?(\/\d+(\.\d+)?)?/.exec(rest)
    if (!m) return { value: 1, coeffN: false }
    this.pos += m[0].length
    const text = m[0]
    if (text.includes('/')) {
      const [num, den] = text.split('/')
      const d = parseFloat(den!)
      if (d === 0) this.error('分母不能为 0')
      return { value: parseFloat(num!) / d, coeffN: false }
    }
    return { value: parseFloat(text), coeffN: false }
  }

  private parseFormula(): {
    formula: string
    atoms: Record<string, number>
    nAtoms?: Record<string, number>
    charge: number
    state?: 'g' | 'l' | 's' | 'aq'
    gas: boolean
    ppt: boolean
  } {
    this.skipWs()
    const atoms: Record<string, number> = {}
    let nAtoms: Record<string, number> | undefined
    let formula = ''
    let charge = 0
    let state: 'g' | 'l' | 's' | 'aq' | undefined
    let gas = false
    let ppt = false

    for (;;) {
      const c = this.peek()
      if (c === '') break
      // 状态符号 (g)/(l)/(s)/(aq) — 需先于基团判断
      if (c === '(') {
        const stateHit = this.tryParseState()
        if (stateHit) {
          state = stateHit
          continue
        }
        // 括号基团（含聚合度下标，如 (C6H10O5)n）
        this.pos++
        const inner = this.parseFormula()
        if (this.peek() !== ')') this.error('括号未闭合')
        this.pos++
        const nSub = this.peek() === 'n'
        // 数字后随 +/- 时属电荷（如 (Fe(CN)6)3- 类），非下标，留给电荷正则
        const sub = nSub ? 1 : /^\d*[+-]/.test(this.src.slice(this.pos)) ? 1 : this.readDigits() || 1
        if (nSub) this.pos++
        const target = nSub ? (nAtoms ??= {}) : atoms
        for (const [el, n] of Object.entries(inner.atoms)) target[el] = (target[el] ?? 0) + n * sub
        if (inner.nAtoms) {
          for (const [el, n] of Object.entries(inner.nAtoms)) {
            ;(nAtoms ??= {})[el] = (nAtoms[el] ?? 0) + n * sub
          }
        }
        formula += nSub ? `(${inner.formula})n` : sub !== 1 ? `(${inner.formula})${sub}` : `(${inner.formula})`
        continue
      }
      // 方括号聚合基团（如 [-CH2-CH2-]n）
      if (c === '[') {
        this.pos++
        const inner = this.parseFormula()
        if (this.peek() !== ']') this.error('方括号基团未闭合')
        this.pos++
        const nSub = this.peek() === 'n'
        // 数字后随 +/- 时属电荷（如 [Cu(NH3)4]2+、[Fe(CN)6]3-），非下标，留给电荷正则
        const sub = nSub ? 1 : /^\d*[+-]/.test(this.src.slice(this.pos)) ? 1 : this.readDigits() || 1
        if (nSub) this.pos++
        const target = nSub ? (nAtoms ??= {}) : atoms
        for (const [el, n] of Object.entries(inner.atoms)) target[el] = (target[el] ?? 0) + n * sub
        if (inner.nAtoms) {
          for (const [el, n] of Object.entries(inner.nAtoms)) {
            ;(nAtoms ??= {})[el] = (nAtoms[el] ?? 0) + n * sub
          }
        }
        formula += nSub ? `[${inner.formula}]n` : sub !== 1 ? `[${inner.formula}]${sub}` : `[${inner.formula}]`
        continue
      }
      // 电子 e^- / e-
      if (c === 'e' && (this.src[this.pos + 1] === '^' || this.src[this.pos + 1] === '-')) {
        this.pos++ // e
        if (this.peek() === '^') {
          this.pos++
          const sign = this.src[this.pos]
          if (sign !== '-') this.error('电子电荷应为 -1')
          this.pos++
        } else {
          this.pos++ // '-'
        }
        formula += 'e^-'
        charge = -1
        continue
      }
      // 元素
      if (/[A-Z]/.test(c)) {
        const isFirst = Object.keys(atoms).length === 0
        const { sym, sub, asCharge } = this.parseElement(isFirst)
        atoms[sym] = (atoms[sym] ?? 0) + sub
        formula += sub > 1 ? `${sym}${sub}` : sym
        if (asCharge !== undefined) charge = asCharge
        continue
      }
      // 键（后随元素、'(' 或基团右括号 ')'/']'；后者为链末端键，如 [-CH2-CH2-] 的末尾 '-'）
      if (BOND_CHARS.has(c) && /[A-Z()\]]/.test(this.src[this.pos + 1] ?? '')) {
        formula += c
        this.pos++
        continue
      }
      break
    }

    if (formula === '') this.error('无法解析的物质（应为元素符号开头）')

    // 电荷（无 ^ 形式：数字后随 +/-，或单独 +/-）；负前瞻排除基团右括号前的假电荷
    if (charge === 0) {
      const m = /^\d*([+-])(?![\])])/.exec(this.src.slice(this.pos))
      if (m) {
        const digits = m[0].slice(0, -1)
        const sign = m[0].slice(-1)
        this.pos += m[0].length
        // 基团后的数字电荷（如 Fe(CN)63- → 电荷 3-）取最后一位；
        // 单独符号为 ±1（如 OH-、Cl-）
        const q = digits.length > 0 ? parseInt(digits.slice(-1), 10) : 1
        charge = sign === '-' ? -q : q
      }
    }

    // ↑ ↓
    if (this.peek() === '↑') {
      gas = true
      this.pos++
    }
    if (this.peek() === '↓') {
      ppt = true
      this.pos++
    }

    return { formula, atoms, nAtoms, charge, state, gas, ppt }
  }

  private tryParseState(): 'g' | 'l' | 's' | 'aq' | null {
    // 当前字符为 '('；检查是否为 (g)/(l)/(s)/(aq) 且后不随数字
    const close = this.src.indexOf(')', this.pos)
    if (close === -1) return null
    const content = this.src.slice(this.pos + 1, close).trim()
    if (STATE_SET.has(content)) {
      const after = this.src[close + 1] ?? ''
      if (!/\d/.test(after)) {
        this.pos = close + 1
        return content as 'g' | 'l' | 's' | 'aq'
      }
    }
    return null
  }

  private parseElement(isFirstElement: boolean): { sym: string; sub: number; asCharge?: number } {
    const two = this.src.slice(this.pos, this.pos + 2)
    let sym: string
    if (two.length === 2 && ELEMENTS.has(two)) {
      sym = two
      this.pos += 2
    } else {
      const one = this.src[this.pos]!
      if (!ELEMENTS.has(one)) this.error(`未知元素符号「${one}」`)
      sym = one
      this.pos++
    }
    const digits = this.readDigits()
    // 电荷形式一：元素后带 ^（如 Fe^3+、SO4^2-、Ba^2+）
    if (this.peek() === '^') {
      this.pos++
      const chargeDigits = this.readDigits()
      const sign = this.peek()
      if (sign !== '+' && sign !== '-') this.error('电荷缺少正负号')
      this.pos++
      const q = chargeDigits || 1
      return { sym, sub: digits || 1, asCharge: sign === '-' ? -q : q }
    }
    // 电荷形式二：无 ^，数字后随符号（如 Cu2+、SO42-）
    if (digits > 0) {
      const sign = this.src[this.pos]
      const isMinusBond = sign === '-' && /[A-Z()\]]/.test(this.src[this.pos + 1] ?? '')
      if ((sign === '+' || sign === '-') && !isMinusBond) {
        this.pos++
        const d = String(digits)
        // 单元素单数字（Cu2+、Fe3+）：数字为电荷，无下标
        if (d.length === 1 && isFirstElement) {
          const q = digits
          return { sym, sub: 1, asCharge: sign === '-' ? -q : q }
        }
        // 多元素单数字（NO3-、NH4+）：数字为下标，电荷 ±1
        // 多位数字（SO42-、CO32-）：最后一位为电荷，其余为下标
        const isMulti = d.length >= 2
        const chargeDigit = isMulti ? parseInt(d[d.length - 1]!, 10) : 1
        const sub = isMulti ? parseInt(d.slice(0, -1), 10) : digits
        const q = isMulti ? chargeDigit : 1
        return { sym, sub, asCharge: sign === '-' ? -q : q }
      }
    }
    return { sym, sub: digits || 1 }
  }

  private readDigits(): number {
    const m = /^\d+/.exec(this.src.slice(this.pos))
    if (!m) return 0
    this.pos += m[0].length
    return parseInt(m[0], 10)
  }
}

/** 解析规范式方程字符串，失败抛 ParseError */
export function parseEquation(src: string): ParsedEquation {
  return new Parser(src).parse()
}

/** 尝试解析，失败返回错误消息 */
export function tryParseEquation(src: string): { eq?: ParsedEquation; error?: string } {
  try {
    return { eq: parseEquation(src) }
  } catch (e) {
    return { error: e instanceof ParseError ? e.message : String(e) }
  }
}
