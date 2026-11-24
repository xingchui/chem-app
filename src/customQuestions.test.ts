import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadCustomQuestions,
  saveCustomQuestions,
  parseCustomText,
  exportToJSON,
  importFromJSON,
  assignUniqueIds,
  mergeCustomQuestions,
  type CustomQuestion,
} from './customQuestions'

// Mock localStorage
const store: Record<string, string> = {}
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
}
vi.stubGlobal('localStorage', mockLocalStorage)

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k]
  vi.clearAllMocks()
})

describe('loadCustomQuestions', () => {
  it('空 localStorage 返回空数组', () => {
    expect(loadCustomQuestions()).toEqual([])
  })

  it('损坏数据返回空数组', () => {
    store['chem-custom-questions'] = 'not json'
    expect(loadCustomQuestions()).toEqual([])
  })

  it('加载有效数据', () => {
    const qs: CustomQuestion[] = [{ id: 1, answer: 'H2 + O2 = H2O', description: '' }]
    store['chem-custom-questions'] = JSON.stringify(qs)
    expect(loadCustomQuestions()).toEqual(qs)
  })

  it('过滤空答案与无法解析的题目', () => {
    store['chem-custom-questions'] = JSON.stringify([
      { id: 1, answer: '2H2 + O2 = 2H2O', description: '' },
      { id: 2, answer: 'H2O', description: '' },
      { id: 3, answer: '   ', description: '' },
    ])
    expect(loadCustomQuestions()).toEqual([{ id: 1, answer: '2H2 + O2 = 2H2O', description: '' }])
  })

  it('修复历史数据中的重复 id', () => {
    store['chem-custom-questions'] = JSON.stringify([
      { id: 7, answer: '2H2 + O2 = 2H2O', description: '' },
      { id: 7, answer: 'H2O = H2 + 1/2O2', description: '' },
    ])
    const loaded = loadCustomQuestions()
    expect(loaded).toHaveLength(2)
    expect(new Set(loaded.map(q => q.id)).size).toBe(2)
  })
})

describe('saveCustomQuestions', () => {
  it('保存并读回', () => {
    const qs: CustomQuestion[] = [{ id: 1, answer: '2H2 + O2 = 2H2O', description: 'test' }]
    saveCustomQuestions(qs)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('chem-custom-questions', JSON.stringify(qs))
    expect(loadCustomQuestions()).toEqual(qs)
  })
})

describe('parseCustomText', () => {
  it('空文本返回空数组', () => {
    expect(parseCustomText('')).toEqual([])
    expect(parseCustomText('   \n  \n  ')).toEqual([])
  })

  it('解析有效方程式', () => {
    const results = parseCustomText('2H2 + O2 = 2H2O\nH2O = H2 + 1/2O2')
    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(true)
    expect(results[0].question?.answer).toBe('2H2 + O2 = 2H2O')
    expect(results[1].success).toBe(true)
  })

  it('无效方程式返回错误', () => {
    const results = parseCustomText('invalid equation here')
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(false)
    expect(results[0].error).toBeDefined()
  })

  it('混合有效和无效', () => {
    const results = parseCustomText('2H2 + O2 = 2H2O\nnot an equation\nH2O = H2 + 1/2O2')
    expect(results).toHaveLength(3)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(false)
    expect(results[2].success).toBe(true)
  })

  it('带条件的方程式', () => {
    const results = parseCustomText('Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑')
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(true)
    expect(results[0].question?.answer).toBe('Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑')
  })

  it('支持「描述 | 方程式」补充题干', () => {
    const results = parseCustomText('实验室制氧气 | 2KMnO4 =[加热] K2MnO4 + MnO2 + O2↑')
    expect(results[0].success).toBe(true)
    expect(results[0].question?.description).toBe('实验室制氧气')
    expect(results[0].question?.answer).toBe('2KMnO4 =[加热] K2MnO4 + MnO2 + O2↑')
  })

  it('支持全角分隔符', () => {
    const results = parseCustomText('实验室制氧气｜2KMnO4 =[加热] K2MnO4 + MnO2 + O2↑')
    expect(results[0].success).toBe(true)
    expect(results[0].question?.description).toBe('实验室制氧气')
  })
})

describe('exportToJSON', () => {
  it('输出有效 JSON', () => {
    const qs: CustomQuestion[] = [{ id: 1, answer: 'H2O', description: '' }]
    const json = exportToJSON(qs)
    expect(JSON.parse(json)).toEqual(qs)
  })
})

describe('importFromJSON', () => {
  it('导入有效 JSON', () => {
    const qs: CustomQuestion[] = [{ id: 1, answer: '2H2 + O2 = 2H2O', description: 'test' }]
    const result = importFromJSON(JSON.stringify(qs))
    expect(result).toEqual(qs)
  })

  it('导入无效 JSON 抛异常', () => {
    expect(() => importFromJSON('not json')).toThrow()
  })

  it('导入非数组 JSON 抛异常', () => {
    expect(() => importFromJSON('{"a": 1}')).toThrow()
  })

  it('导入无法解析的方程式抛异常', () => {
    expect(() => importFromJSON(JSON.stringify([{ id: 1, answer: 'H2O', description: '' }]))).toThrow('无法解析')
  })

  it('导入缺少 answer 抛异常', () => {
    expect(() => importFromJSON(JSON.stringify([{ id: 1 }]))).toThrow('缺少 answer')
  })

  it('修复导入文件内部的重复 id', () => {
    const result = importFromJSON(
      JSON.stringify([
        { id: 5, answer: '2H2 + O2 = 2H2O', description: '' },
        { id: 5, answer: 'H2O = H2 + 1/2O2', description: '' },
      ]),
    )
    expect(result).toHaveLength(2)
    expect(new Set(result.map(q => q.id)).size).toBe(2)
  })
})

describe('assignUniqueIds', () => {
  it('保留不冲突的 id', () => {
    const qs: CustomQuestion[] = [
      { id: 1, answer: 'a', description: '' },
      { id: 2, answer: 'b', description: '' },
    ]
    expect(assignUniqueIds(qs).map(q => q.id)).toEqual([1, 2])
  })

  it('重复 id 只保留第一个，后续重新分配', () => {
    const qs: CustomQuestion[] = [
      { id: 9, answer: 'a', description: '' },
      { id: 9, answer: 'b', description: '' },
    ]
    const result = assignUniqueIds(qs)
    expect(result[0].id).toBe(9)
    expect(result[1].id).not.toBe(9)
    expect(result[0].answer).toBe('a')
    expect(result[1].answer).toBe('b')
  })

  it('非法 id（0、负数、NaN）重新分配', () => {
    const qs: CustomQuestion[] = [
      { id: 0, answer: 'a', description: '' },
      { id: -3, answer: 'b', description: '' },
      { id: NaN, answer: 'c', description: '' },
    ]
    const result = assignUniqueIds(qs)
    expect(result.every(q => Number.isInteger(q.id) && q.id > 0)).toBe(true)
    expect(new Set(result.map(q => q.id)).size).toBe(3)
  })

  it('避开 reserved 中已占用的 id', () => {
    const result = assignUniqueIds([{ id: 4, answer: 'a', description: '' }], [4, 5])
    expect(result[0].id).not.toBe(4)
    expect(result[0].id).not.toBe(5)
  })
})

describe('mergeCustomQuestions', () => {
  it('保留已有题目并让新增题目避开已有 id', () => {
    const existing: CustomQuestion[] = [{ id: 1, answer: 'a', description: '' }]
    const incoming: CustomQuestion[] = [
      { id: 1, answer: 'b', description: '' },
      { id: 2, answer: 'c', description: '' },
    ]
    const merged = mergeCustomQuestions(existing, incoming)
    expect(merged.map(q => q.answer)).toEqual(['a', 'b', 'c'])
    expect(new Set(merged.map(q => q.id)).size).toBe(3)
  })
})
