import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadCustomQuestions,
  saveCustomQuestions,
  parseCustomText,
  exportToJSON,
  importFromJSON,
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
    const qs: CustomQuestion[] = [{ id: 1, answer: 'H2O', description: 'test' }]
    const result = importFromJSON(JSON.stringify(qs))
    expect(result).toEqual(qs)
  })

  it('导入无效 JSON 抛异常', () => {
    expect(() => importFromJSON('not json')).toThrow()
  })

  it('导入非数组 JSON 抛异常', () => {
    expect(() => importFromJSON('{"a": 1}')).toThrow()
  })
})
