import { describe, it, expect } from 'vitest'
import { judge, type Judgement } from './judge'

const REF = 'Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑'

describe('judge 判定引擎', () => {
  it('完全正确：无反馈', () => {
    const j = judge(REF, REF)
    expect(j.correct).toBe(true)
    expect(j.messages).toHaveLength(0)
  })

  it('系数成倍（归一后）正确：2,6,4,6 ≡ 1,3,2,3', () => {
    const j = judge('2Fe2O3 + 6CO =[高温] 4Fe + 6CO2↑', REF)
    expect(j.correct).toBe(true)
    expect(j.messages).toHaveLength(0)
  })

  it('分数系数归一正确：1/2,1/2,1 ≡ 1,1,2', () => {
    const j = judge('1/2 H2 + 1/2 Cl2 = HCl', 'H2 + Cl2 = 2HCl')
    expect(j.correct).toBe(true)
  })

  it('系数错误定位到具体项', () => {
    const j = judge('Fe2O3 + 2CO =[高温] 2Fe + 3CO2↑', REF)
    expect(j.correct).toBe(false)
    const co = j.termChecks.find(t => t.side === 'reactants' && t.index === 1)!
    expect(co.coefficientOk).toBe(false)
    expect(j.messages.some(m => m.includes('CO'))).toBe(true)
  })

  it('化学式错误定位', () => {
    const j = judge('FeO + 3CO =[高温] 2Fe + 3CO2↑', REF)
    expect(j.correct).toBe(false)
    const t = j.termChecks.find(x => x.side === 'reactants' && x.index === 0)!
    expect(t.formulaOk).toBe(false)
    expect(t.refFormula).toBe('Fe2O3')
    expect(t.userFormula).toBe('FeO')
  })

  it('状态符号错误', () => {
    const j = judge('Fe2O3(s) + 3CO =[高温] 2Fe + 3CO2↑', REF)
    expect(j.correct).toBe(false)
    const t = j.termChecks[0]!
    expect(t.stateOk).toBe(false)
  })

  it('气体/沉淀符号错误', () => {
    const j = judge('Fe2O3 + 3CO =[高温] 2Fe + 3CO2', REF)
    expect(j.correct).toBe(false)
    const co2 = j.termChecks.find(t => t.side === 'products' && t.index === 1)!
    expect(co2.gasOk).toBe(false)
  })

  it('箭头：= 与 → 等价，⇌ 需严格匹配', () => {
    expect(judge('Fe2O3 + 3CO →[高温] 2Fe + 3CO2↑', REF).correct).toBe(true)
    const wrong = judge('Fe2O3 + 3CO ⇌[高温] 2Fe + 3CO2↑', REF)
    expect(wrong.correct).toBe(false)
    expect(wrong.arrowOk).toBe(false)
  })

  it('条件缺失/写错', () => {
    const miss = judge('Fe2O3 + 3CO = 2Fe + 3CO2↑', REF)
    expect(miss.correct).toBe(false)
    expect(miss.condOk).toBe(false)
    const wrong = judge('Fe2O3 + 3CO =[点燃] 2Fe + 3CO2↑', REF)
    expect(wrong.condOk).toBe(false)
    expect(wrong.messages.some(m => m.includes('高温'))).toBe(true)
  })

  it('离子电荷错误', () => {
    const j = judge('Ba+ + SO42- = BaSO4↓', 'Ba^2+ + SO4^2- = BaSO4↓')
    expect(j.correct).toBe(false)
    const t = j.termChecks[0]!
    expect(t.chargeOk).toBe(false)
  })

  it('物质数量不符', () => {
    const j = judge('Ca + C + O3 = CaO + CO2↑', 'CaCO3 = CaO + CO2↑')
    expect(j.correct).toBe(false)
    expect(j.messages.some(m => m.includes('数量'))).toBe(true)
  })

  it('原子守恒诊断：用户方程自身不平衡', () => {
    const j = judge('H2 + O2 = H2O', '2H2 + O2 = 2H2O')
    expect(j.correct).toBe(false)
    const o = j.balance.find(b => b.element === 'O')!
    expect(o.userReactants).toBe(2)
    expect(o.userProducts).toBe(1)
    expect(o.ok).toBe(false)
    expect(j.messages.some(m => m.includes('O'))).toBe(true)
  })

  it('电荷守恒诊断（离子方程式）', () => {
    const j = judge('Fe + Cu2+ = Fe2+ + Cu', 'Fe + Cu^2+ = Fe^2+ + Cu')
    expect(j.correct).toBe(true)
  })

  it('判定返回结构化逐项结果', () => {
    const j: Judgement = judge(REF, REF)
    expect(j.termChecks).toHaveLength(4)
    for (const t of j.termChecks) {
      expect(t.formulaOk).toBe(true)
      expect(t.coefficientOk).toBe(true)
      expect(t.stateOk).toBe(true)
      expect(t.chargeOk).toBe(true)
      expect(t.gasOk).toBe(true)
      expect(t.pptOk).toBe(true)
    }
    expect(j.arrowOk).toBe(true)
    expect(j.condOk).toBe(true)
  })

  it('加聚反应自判正确（n 系数+方括号基团）', () => {
    const j = judge('nCH2=CH2 = [-CH2-CH2-]n', 'nCH2=CH2 = [-CH2-CH2-]n')
    expect(j.correct).toBe(true)
    expect(j.messages).toHaveLength(0)
    expect(j.balance.every(b => b.ok)).toBe(true)
  })

  it('方括号与圆括号聚合物等价：(CH2CH2)n ≡ [-CH2-CH2-]n', () => {
    const j = judge('nCH2=CH2 = (CH2CH2)n', 'nCH2=CH2 = [-CH2-CH2-]n')
    expect(j.correct).toBe(true)
  })

  it('单体省略 n 判错（常数/聚合守恒不匹配）', () => {
    const j = judge('CH2=CH2 = [-CH2-CH2-]n', 'nCH2=CH2 = [-CH2-CH2-]n')
    expect(j.correct).toBe(false)
    expect(j.messages.some(m => m.includes('不守恒'))).toBe(true)
  })

  it('n 系数错误判错（2n 单体 vs n 聚合物）', () => {
    const j = judge('2nCH2=CH2 = [-CH2-CH2-]n', 'nCH2=CH2 = [-CH2-CH2-]n')
    expect(j.correct).toBe(false)
  })

  it('水解反应（n 下标基团）自判正确', () => {
    const j = judge('(C6H10O5)n + nH2O =[稀硫酸][加热] nC6H12O6', '(C6H10O5)n + nH2O =[稀硫酸][加热] nC6H12O6')
    expect(j.correct).toBe(true)
    const c = j.balance.find(b => b.element === 'C')!
    expect(c.userReactantsN).toBe(6)
    expect(c.userProductsN).toBe(6)
    expect(c.userReactants).toBe(0)
  })

  it('纤维素硝酸酯（3n 系数）自判正确', () => {
    const j = judge(
      '[C6H7O2(OH)3]n + 3nHNO3 =[浓硫酸] [C6H7O2(ONO2)3]n + 3nH2O',
      '[C6H7O2(OH)3]n + 3nHNO3 =[浓硫酸] [C6H7O2(ONO2)3]n + 3nH2O',
    )
    expect(j.correct).toBe(true)
  })
})
