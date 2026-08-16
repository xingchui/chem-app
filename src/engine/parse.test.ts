import { describe, it, expect } from 'vitest'
import { parseEquation, ParseError } from './parse'

describe('parseEquation', () => {
  it('解析基本化学方程式：系数+下标+条件', () => {
    const eq = parseEquation('Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑')
    expect(eq.arrow).toBe('=')
    expect(eq.condAbove).toBe('高温')
    expect(eq.condBelow).toBeUndefined()
    expect(eq.reactants.map(t => t.formula)).toEqual(['Fe2O3', 'CO'])
    expect(eq.reactants.map(t => t.coefficient)).toEqual([1, 3])
    expect(eq.products.map(t => t.formula)).toEqual(['Fe', 'CO2'])
    expect(eq.products[1].gas).toBe(true)
  })

  it('解析可逆符号与上下双条件', () => {
    const eq = parseEquation('N2 + 3H2 ⇌[高温高压][催化剂] 2NH3')
    expect(eq.arrow).toBe('⇌')
    expect(eq.condAbove).toBe('高温高压')
    expect(eq.condBelow).toBe('催化剂')
  })

  it('解析括号基团与沉淀符号', () => {
    const eq = parseEquation('Ca(OH)2 + CO2 = CaCO3↓ + H2O')
    expect(eq.products[0].formula).toBe('CaCO3')
    expect(eq.products[0].ppt).toBe(true)
    expect(eq.reactants[0].formula).toBe('Ca(OH)2')
  })

  it('解析离子电荷（^ 形式）', () => {
    const eq = parseEquation('Ba^2+ + SO4^2- = BaSO4↓')
    expect(eq.reactants[0].charge).toBe(2)
    expect(eq.reactants[1].charge).toBe(-2)
  })

  it('解析离子电荷（无 ^ 形式）', () => {
    const eq = parseEquation('Fe + Cu2+ = Fe2+ + Cu')
    expect(eq.reactants[1].charge).toBe(2)
    expect(eq.products[0].charge).toBe(2)
  })

  it('无 ^ 多位电荷：SO42- 拆分为下标+电荷', () => {
    const eq = parseEquation('Ba2+ + SO42- = BaSO4↓')
    const so4 = eq.reactants[1]
    expect(so4.formula).toBe('SO4')
    expect(so4.charge).toBe(-2)
    expect(so4.atoms).toEqual({ S: 1, O: 4 })
  })

  it('无 ^ 单数字电荷：NO3- / NH4+ / OH- 下标与电荷分离', () => {
    const eq = parseEquation('NH4+ + OH- = NH3↑ + H2O')
    expect(eq.reactants[0].formula).toBe('NH4')
    expect(eq.reactants[0].charge).toBe(1)
    expect(eq.reactants[0].atoms).toEqual({ N: 1, H: 4 })
    expect(eq.reactants[1].formula).toBe('OH')
    expect(eq.reactants[1].charge).toBe(-1)
    const no3 = parseEquation('Cu + NO3- = Cu2+ + NO↑').reactants[1]
    expect(no3.formula).toBe('NO3')
    expect(no3.charge).toBe(-1)
    expect(no3.atoms).toEqual({ N: 1, O: 3 })
  })

  it('有机物连字符不被误判为电荷', () => {
    const eq = parseEquation('CH3-CH3 + Cl2 →[光照] CH3CH2Cl + HCl')
    expect(eq.reactants[0].formula).toBe('CH3-CH3')
    expect(eq.reactants[0].charge).toBe(0)
    expect(eq.reactants[0].atoms).toEqual({ C: 2, H: 6 })
  })

  it('解析分数系数', () => {
    const eq = parseEquation('1/2 H2 + 1/2 Cl2 = HCl')
    expect(eq.reactants[0].coefficient).toBe(0.5)
    expect(eq.reactants[1].coefficient).toBe(0.5)
  })

  it('解析有机物结构简式', () => {
    const eq = parseEquation('CH3CH2OH + 3O2 →[点燃] 2CO2 + 3H2O')
    expect(eq.reactants[0].formula).toBe('CH3CH2OH')
    expect(eq.arrow).toBe('→')
  })

  it('解析有机物双键/三键与连字符', () => {
    const eq1 = parseEquation('CH2=CH2 + H2O →[催化剂][加热加压] CH3CH2OH')
    expect(eq1.condBelow).toBe('加热加压')
    const eq2 = parseEquation('CH≡CH + 2H2 →[催化剂] CH3-CH3')
    expect(eq2.reactants[0].formula).toBe('CH≡CH')
  })

  it('解析状态符号 (g)(l)(s)(aq)', () => {
    const eq = parseEquation('H2(g) + Cl2(g) = 2HCl(g)')
    expect(eq.reactants[0].state).toBe('g')
    expect(eq.products[0].state).toBe('g')
  })

  it('解析电子 e^-', () => {
    const eq = parseEquation('2H2O =[通电] 2H2↑ + O2↑')
    expect(eq.condAbove).toBe('通电')
    const eq2 = parseEquation('Fe^3+ + e^- = Fe^2+')
    expect(eq2.reactants[1].formula).toBe('e^-')
    expect(eq2.reactants[1].charge).toBe(-1)
  })

  it('元素计数：括号基团与多元素', () => {
    const { reactants } = parseEquation('Al2(SO4)3 + Ca(OH)2 = Al(OH)3 + CaSO4')
    expect(reactants[0].atoms).toEqual({ Al: 2, S: 3, O: 12 })
    expect(reactants[1].atoms).toEqual({ Ca: 1, O: 2, H: 2 })
  })

  it('元素计数：有机物结构简式', () => {
    const eq = parseEquation('CH3CH2OH + 3O2 → 2CO2 + 3H2O')
    expect(eq.reactants[0].atoms).toEqual({ C: 2, H: 6, O: 1 })
  })

  it('解析失败抛出 ParseError', () => {
    expect(() => parseEquation('Fe2O3 + = 2Fe')).toThrow(ParseError)
    expect(() => parseEquation('')).toThrow(ParseError)
    expect(() => parseEquation('H2O')).toThrow(ParseError) // 缺少箭头
  })

  it('无系数默认 1', () => {
    const eq = parseEquation('NaOH + HCl = NaCl + H2O')
    expect(eq.reactants.every(t => t.coefficient === 1)).toBe(true)
  })

  it('聚合系数 n：nCH2=CH2', () => {
    const eq = parseEquation('nCH2=CH2 = [-CH2-CH2-]n')
    const mono = eq.reactants[0]!
    expect(mono.formula).toBe('CH2=CH2')
    expect(mono.coefficient).toBe(1)
    expect(mono.coeffN).toBe(true)
    expect(mono.atoms).toEqual({ C: 2, H: 4 })
    const poly = eq.products[0]!
    expect(poly.formula).toBe('[-CH2-CH2-]n')
    expect(poly.coeffN).toBe(false)
    expect(poly.atoms).toEqual({})
    expect(poly.nAtoms).toEqual({ C: 2, H: 4 })
  })

  it('聚合系数数字+n：3nHNO3', () => {
    const eq = parseEquation('[C6H7O2(OH)3]n + 3nHNO3 =[浓硫酸] [C6H7O2(ONO2)3]n + 3nH2O')
    const acid = eq.reactants[1]!
    expect(acid.coefficient).toBe(3)
    expect(acid.coeffN).toBe(true)
  })

  it('n 系数不误吞 N2 / Na 开头', () => {
    const eq = parseEquation('N2 + 3H2 = 2NH3')
    expect(eq.reactants[0]!.coeffN).toBe(false)
    expect(eq.reactants[0]!.coefficient).toBe(1)
    const eq2 = parseEquation('Na + H2O = NaOH + 1/2H2↑')
    expect(eq2.reactants[0]!.coeffN).toBe(false)
  })

  it('圆括号聚合基团：(C6H10O5)n', () => {
    const eq = parseEquation('(C6H10O5)n + nH2O = nC6H12O6')
    const poly = eq.reactants[0]!
    expect(poly.formula).toBe('(C6H10O5)n')
    expect(poly.atoms).toEqual({})
    expect(poly.nAtoms).toEqual({ C: 6, H: 10, O: 5 })
    const water = eq.reactants[1]!
    expect(water.coeffN).toBe(true)
    expect(water.atoms).toEqual({ H: 2, O: 1 })
  })

  it('条件与方括号聚合基团歧义消解：[催化剂] 为条件', () => {
    const eq = parseEquation('nCH2=CH2 =[催化剂][加热] [-CH2-CH2-]n')
    expect(eq.condAbove).toBe('催化剂')
    expect(eq.condBelow).toBe('加热')
    expect(eq.products.map(t => t.formula)).toEqual(['[-CH2-CH2-]n'])
  })

  it('方括号聚合基团紧随条件之后（酚醛缩聚）', () => {
    const eq = parseEquation('nC6H5OH + nHCHO =[催化剂] [-C6H3OH-CH2-]n + nH2O')
    expect(eq.condAbove).toBe('催化剂')
    expect(eq.products[0]!.formula).toBe('[-C6H3OH-CH2-]n')
    expect(eq.products[0]!.nAtoms).toEqual({ C: 7, H: 6, O: 1 })
    expect(eq.products[1]!.coeffN).toBe(true)
  })

  it('方括号聚合基团内末尾连字符不被误判为电荷', () => {
    const eq = parseEquation('nCF2=CF2 = [-CF2-CF2-]n')
    expect(eq.products[0]!.formula).toBe('[-CF2-CF2-]n')
    expect(eq.products[0]!.charge).toBe(0)
    expect(eq.products[0]!.nAtoms).toEqual({ C: 2, F: 4 })
  })

  it('纤维素硝酸酯：方括号基团+3n 系数', () => {
    const eq = parseEquation('[C6H7O2(OH)3]n + 3nHNO3 =[浓硫酸] [C6H7O2(ONO2)3]n + 3nH2O')
    expect(eq.condAbove).toBe('浓硫酸')
    const cellulose = eq.reactants[0]!
    expect(cellulose.formula).toBe('[C6H7O2(OH)3]n')
    expect(cellulose.nAtoms).toEqual({ C: 6, H: 10, O: 5 })
    const nitrate = eq.products[0]!
    expect(nitrate.formula).toBe('[C6H7O2(ONO2)3]n')
    expect(nitrate.nAtoms).toEqual({ C: 6, H: 7, N: 3, O: 11 })
    expect(eq.products[1]!.coefficient).toBe(3)
    expect(eq.products[1]!.coeffN).toBe(true)
  })

  it('方括号基团出现在反应物侧（非条件位置）', () => {
    const eq = parseEquation('[-CH2-CH2-]n + O2 = CO2 + H2O')
    expect(eq.reactants[0]!.formula).toBe('[-CH2-CH2-]n')
  })

  it('条件写在水侧起点仍报错（中文条件非化学式）', () => {
    expect(() => parseEquation('[催化剂] = [-CH2-CH2-]n')).toThrow(ParseError)
  })
})
