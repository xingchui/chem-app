import { describe, it, expect, vi, afterEach } from 'vitest'
import { customToQuestions, progressPercent, shuffle } from './practice'
import type { CustomQuestion } from './customQuestions'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('shuffle', () => {
  it('返回相同元素且不修改原数组', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    const result = shuffle(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
    expect(input).toEqual(copy)
  })

  it('空数组与单元素安全', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([1])).toEqual([1])
  })

  it('按 Fisher–Yates 交换', () => {
    // Math.random 恒为 0 → 每次都与下标 0 交换
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(shuffle([1, 2, 3])).toEqual([2, 3, 1])
  })
})

describe('customToQuestions', () => {
  it('补齐教材归属与题干', () => {
    const items: CustomQuestion[] = [
      { id: 1, answer: '2H2 + O2 = 2H2O', description: '氢气燃烧' },
      { id: 2, answer: 'H2O = H2 + 1/2O2', description: '' },
    ]
    expect(customToQuestions(items)).toEqual([
      {
        id: 1,
        book: '自定义',
        chapter: '自定义',
        section: '自定义',
        description: '氢气燃烧',
        answer: '2H2 + O2 = 2H2O',
      },
      {
        id: 2,
        book: '自定义',
        chapter: '自定义',
        section: '自定义',
        description: '请写出：H2O = H2 + 1/2O2',
        answer: 'H2O = H2 + 1/2O2',
      },
    ])
  })

  it('空数组返回空数组', () => {
    expect(customToQuestions([])).toEqual([])
  })
})

describe('progressPercent', () => {
  it('未判定时按当前题号计', () => {
    expect(progressPercent(0, 10, false)).toBe(0)
    expect(progressPercent(5, 10, false)).toBe(50)
  })

  it('判定后计入当前题', () => {
    expect(progressPercent(0, 10, true)).toBe(10)
    expect(progressPercent(9, 10, true)).toBe(100)
  })

  it('总数非正或越界时收敛到 0–100', () => {
    expect(progressPercent(0, 0, true)).toBe(0)
    expect(progressPercent(99, 10, true)).toBe(100)
    expect(progressPercent(-5, 10, false)).toBe(0)
  })
})
