import { describe, it, expect } from 'vitest'
import katex from 'katex'
import { parseEquation } from './parse'
import { formulaToLatex, termToLatex, eqToLatex } from './latex'

describe('formulaToLatex', () => {
  it('普通化学式：下标', () => {
    expect(formulaToLatex('Fe2O3')).toBe('Fe_{2}O_{3}')
    expect(formulaToLatex('H2O')).toBe('H_{2}O')
  })

  it('括号基团下标', () => {
    expect(formulaToLatex('Ca(OH)2')).toBe('Ca(OH)_{2}')
  })

  it('有机物结构简式', () => {
    expect(formulaToLatex('CH3CH2OH')).toBe('CH_{3}CH_{2}OH')
  })

  it('键：≡ # 转义', () => {
    expect(formulaToLatex('CH≡CH')).toBe('CH\\equiv CH')
  })

  it('电荷追加为上标', () => {
    expect(formulaToLatex('SO4', -2)).toBe('SO_{4}^{2-}')
    expect(formulaToLatex('Ba', 2)).toBe('Ba^{2+}')
    expect(formulaToLatex('OH', -1)).toBe('OH^{-}')
    expect(formulaToLatex('e^-')).toBe('e^-')
  })

  it('聚合基团下标：圆括号 n', () => {
    expect(formulaToLatex('(C6H10O5)n')).toBe('(C_{6}H_{10}O_{5})_{n}')
  })

  it('聚合基团下标：方括号 n', () => {
    expect(formulaToLatex('[-CH2-CH2-]n')).toBe('[-CH_{2}-CH_{2}-]_{n}')
    expect(formulaToLatex('[-CF2-CF2-]n')).toBe('[-CF_{2}-CF_{2}-]_{n}')
  })

  it('混合基团：[(C6H7O2(ONO2)3)]n 形式下标', () => {
    expect(formulaToLatex('[C6H7O2(ONO2)3]n')).toBe('[C_{6}H_{7}O_{2}(ONO_{2})_{3}]_{n}')
  })
})

describe('termToLatex', () => {
  it('系数+化学式', () => {
    const { reactants } = parseEquation('3Fe2O3 + CO = 2Fe + CO2')
    expect(termToLatex(reactants[0])).toBe('3Fe_{2}O_{3}')
  })

  it('分数系数', () => {
    const { reactants } = parseEquation('1/2 H2 + 1/2 Cl2 = HCl')
    expect(termToLatex(reactants[0])).toBe('\\frac{1}{2}H_{2}')
  })

  it('状态+气体沉淀', () => {
    const { products } = parseEquation('H2(g) + Cl2(g) = 2HCl(g)')
    expect(termToLatex(products[0])).toBe('2HCl\\text{(g)}')
    const eq2 = parseEquation('CaCO3 = CaO + CO2↑')
    expect(termToLatex(eq2.products[1])).toBe('CO_{2}\\uparrow')
  })

  it('聚合系数 n 与 3n', () => {
    const { reactants } = parseEquation('nCH2=CH2 + 3nHNO3 = [C6H7O2(ONO2)3]n + 3nH2O')
    expect(termToLatex(reactants[0])).toBe('nCH_{2}=CH_{2}')
    expect(termToLatex(reactants[1])).toBe('3nHNO_{3}')
  })

  it('方括号聚合产物 LaTeX', () => {
    const { products } = parseEquation('nCH2=CH2 = [-CH2-CH2-]n')
    expect(termToLatex(products[0])).toBe('[-CH_{2}-CH_{2}-]_{n}')
  })
})

describe('eqToLatex', () => {
  it('等号无条件', () => {
    expect(eqToLatex(parseEquation('NaOH + HCl = NaCl + H2O'))).toBe('NaOH + HCl = NaCl + H_{2}O')
  })

  it('→ 渲染为 \\rightarrow', () => {
    expect(eqToLatex(parseEquation('NaOH + HCl → NaCl + H2O'))).toBe('NaOH + HCl \\rightarrow NaCl + H_{2}O')
  })

  it('→[条件] 渲染为 \\overset{条件}{\\rightarrow}', () => {
    expect(eqToLatex(parseEquation('Fe2O3 + 3CO →[高温] 2Fe + 3CO2↑'))).toBe(
      'Fe_{2}O_{3} + 3CO \\overset{\\text{高温}}{\\rightarrow} 2Fe + 3CO_{2}\\uparrow',
    )
  })

  it('双条件堆叠', () => {
    expect(eqToLatex(parseEquation('N2 + 3H2 ⇌[高温高压][催化剂] 2NH3'))).toBe(
      'N_{2} + 3H_{2} \\overset{\\text{高温高压}}{\\underset{\\text{催化剂}}{\\rightleftharpoons}} 2NH_{3}',
    )
  })

  it('生成 KaTeX 可渲染的 HTML（不抛错）', () => {
    const eq = parseEquation('Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑')
    const tex = eqToLatex(eq)
    const html = katex.renderToString(tex, { throwOnError: true })
    expect(html).toContain('Fe')
  })
})
