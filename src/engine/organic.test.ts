import { describe, it, expect } from 'vitest'
import { judge } from './judge'
import { parseEquation } from './parse'

describe('有机化学方程式判定', () => {
  it('结构简式与分子式等价：C2H5OH ≡ CH3CH2OH', () => {
    const ref = 'CH3CH2OH + 3O2 =[点燃] 2CO2 + 3H2O'
    expect(judge('C2H5OH + 3O2 =[点燃] 2CO2 + 3H2O', ref).correct).toBe(true)
    expect(judge('C2H6O + 3O2 =[点燃] 2CO2 + 3H2O', ref).correct).toBe(true)
  })

  it('分子式等价：C2H4 ≡ CH2=CH2（乙烯加成）', () => {
    const ref = 'CH2=CH2 + Br2 = CH2BrCH2Br'
    expect(judge('C2H4 + Br2 = C2H4Br2', ref).correct).toBe(true)
  })

  it('同分异构体拒绝：CH3OCH3（二甲醚）≠ 乙醇', () => {
    const ref = 'CH3CH2OH + 3O2 =[点燃] 2CO2 + 3H2O'
    const j = judge('CH3OCH3 + 3O2 =[点燃] 2CO2 + 3H2O', ref)
    expect(j.correct).toBe(false)
    expect(j.messages.some(m => m.includes('CH3OCH3'))).toBe(true)
  })

  it('乙酸乙酯与分子式等价：CH3COOC2H5 ≡ C4H8O2', () => {
    const ref = 'CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOC2H5 + H2O'
    expect(judge('CH3COOH + C2H5OH =[浓硫酸][加热] C4H8O2 + H2O', ref).correct).toBe(true)
  })

  it('条件别名：浓H2SO4 / 催化 / 铜 归一化', () => {
    const ref = 'CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOC2H5 + H2O'
    expect(judge('CH3COOH + C2H5OH =[浓H2SO4][加热] CH3COOC2H5 + H2O', ref).correct).toBe(true)
    const ox = '2CH3CH2OH + O2 =[催化剂][加热] 2CH3CHO + 2H2O'
    expect(judge('2C2H5OH + O2 =[铜][加热] 2CH3CHO + 2H2O', ox).correct).toBe(true)
    expect(judge('2C2H5OH + O2 =[催化][加热] 2CH3CHO + 2H2O', ox).correct).toBe(true)
  })

  it('光/见光 → 光照 归一化', () => {
    const ref = 'CH4 + Cl2 =[光照] CH3Cl + HCl'
    expect(judge('CH4 + Cl2 =[光] CH3Cl + HCl', ref).correct).toBe(true)
    expect(judge('CH4 + Cl2 =[见光] CH3Cl + HCl', ref).correct).toBe(true)
  })

  it('无机含碳物质保持严格匹配（CO2 不能被写成 O2C）', () => {
    const j = judge('2O2C + 6CO =[高温] 2Fe + 3CO2↑', 'Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑')
    expect(j.correct).toBe(false)
  })

  it('结构简式原子计数正确：CH3CH2OH 为 C2H6O', () => {
    const eq = parseEquation('CH3CH2OH + 3O2 = 2CO2 + 3H2O')
    expect(eq.reactants[0]!.atoms).toEqual({ C: 2, H: 6, O: 1 })
  })

  it('结构简式原子计数正确：CH3COOH 为 C2H4O2', () => {
    const eq = parseEquation('CH3COOH =[浓硫酸][加热] CH3COOC2H5')
    expect(eq.reactants[0]!.atoms).toEqual({ C: 2, H: 4, O: 2 })
  })

  it('可逆酯化用 ⇌ 判定', () => {
    const ref = 'CH3COOH + CH3CH2OH <=>[浓硫酸][加热] CH3COOC2H5 + H2O'
    const j = judge('CH3COOH + C2H5OH =[浓硫酸][加热] CH3COOC2H5 + H2O', ref)
    expect(j.correct).toBe(false)
    expect(j.arrowOk).toBe(false)
    expect(judge('CH3COOH + C2H5OH <=>[浓硫酸][加热] CH3COOC2H5 + H2O', ref).correct).toBe(true)
  })

  it('反应物顺序无关：先乙醇后乙酸 ≡ 先乙酸后乙醇', () => {
    const ref = 'CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOC2H5 + H2O'
    expect(judge('CH3CH2OH + CH3COOH =[浓硫酸][加热] CH3COOC2H5 + H2O', ref).correct).toBe(true)
  })

  it('生成物顺序无关：H2O 与 CH3COOC2H5 可互换', () => {
    const ref = 'CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOC2H5 + H2O'
    expect(judge('CH3COOH + CH3CH2OH =[浓硫酸][加热] H2O + CH3COOC2H5', ref).correct).toBe(true)
  })

  it('简写与展开等价：CH3COOCH2CH3 ≡ CH3COOC2H5（乙基两种写法）', () => {
    const ref = 'CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOC2H5 + H2O'
    expect(judge('CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOCH2CH3 + H2O', ref).correct).toBe(true)
    // 双向：ref 用展开式、用户用简写式
    const ref2 = 'CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOCH2CH3 + H2O'
    expect(judge('CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOC2H5 + H2O', ref2).correct).toBe(true)
  })

  it('条件可合并/交换：浓硫酸+加热 ≡ [浓硫酸][加热]，上下可互换', () => {
    const ref = 'CH3COOH + CH3CH2OH =[浓硫酸][加热] CH3COOC2H5 + H2O'
    // 合并为单个方括号
    expect(judge('CH3COOH + CH3CH2OH =[浓硫酸+加热] CH3COOC2H5 + H2O', ref).correct).toBe(true)
    // 顺序交换
    expect(judge('CH3COOH + CH3CH2OH =[加热+浓硫酸] CH3COOC2H5 + H2O', ref).correct).toBe(true)
    // 上下位置交换
    expect(judge('CH3COOH + CH3CH2OH =[加热][浓硫酸] CH3COOC2H5 + H2O', ref).correct).toBe(true)
    // 合并 + 别名混用
    expect(judge('CH3COOH + CH3CH2OH =[浓H2SO4+△] CH3COOC2H5 + H2O', ref).correct).toBe(true)
    // 条件缺失仍判错
    expect(judge('CH3COOH + CH3CH2OH =[浓硫酸] CH3COOC2H5 + H2O', ref).correct).toBe(false)
  })

  it('加聚反应自判：氯乙烯', () => {
    const j = judge('nCH2=CHCl = [-CH2-CHCl-]n', 'nCH2=CHCl = [-CH2-CHCl-]n')
    expect(j.correct).toBe(true)
    expect(j.messages).toHaveLength(0)
  })

  it('加聚反应自判：苯乙烯（侧基苯环）', () => {
    const j = judge('nCH2=CH-C6H5 = [-CH2-CH(C6H5)-]n', 'nCH2=CH-C6H5 = [-CH2-CH(C6H5)-]n')
    expect(j.correct).toBe(true)
  })

  it('加聚反应自判：丁二烯（1,3-丁二烯）', () => {
    const j = judge('nCH2=CH-CH=CH2 = [-CH2-CH=CH-CH2-]n', 'nCH2=CH-CH=CH2 = [-CH2-CH=CH-CH2-]n')
    expect(j.correct).toBe(true)
  })

  it('加聚反应自判：四氟乙烯（聚四氟乙烯）', () => {
    const j = judge('nCF2=CF2 = [-CF2-CF2-]n', 'nCF2=CF2 = [-CF2-CF2-]n')
    expect(j.correct).toBe(true)
  })

  it('加聚反应自判：甲基丙烯酸甲酯（有机玻璃）', () => {
    const j = judge(
      'nCH2=C(CH3)COOCH3 = [-CH2-C(CH3)(COOCH3)-]n',
      'nCH2=C(CH3)COOCH3 = [-CH2-C(CH3)(COOCH3)-]n',
    )
    expect(j.correct).toBe(true)
  })

  it('缩聚反应自判：酚醛树脂（方括号基团紧随条件）', () => {
    const j = judge(
      'nC6H5OH + nHCHO =[催化剂] [-C6H3OH-CH2-]n + nH2O',
      'nC6H5OH + nHCHO =[催化剂] [-C6H3OH-CH2-]n + nH2O',
    )
    expect(j.correct).toBe(true)
  })

  it('单体结构简式与 n 系数：乙烯加聚可写成分子式风格', () => {
    const ref = 'nCH2=CH2 = [-CH2-CH2-]n'
    expect(judge('nC2H4 = [-CH2-CH2-]n', ref).correct).toBe(true)
  })
})
