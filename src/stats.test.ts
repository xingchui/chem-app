import { describe, it, expect } from 'vitest'
import {
  EMPTY_STATS,
  STATS_KEY,
  accuracy,
  addResult,
  loadStats,
  normalizeStats,
  saveStats,
  type Stats,
} from './stats'

/** 最小 Storage 实现，避免依赖 jsdom 的 localStorage 状态 */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  } as Storage
}

describe('normalizeStats', () => {
  it('非对象归零', () => {
    expect(normalizeStats(null)).toEqual(EMPTY_STATS)
    expect(normalizeStats('x')).toEqual(EMPTY_STATS)
    expect(normalizeStats(undefined)).toEqual(EMPTY_STATS)
  })

  it('负数、NaN、非整数被修正', () => {
    expect(normalizeStats({ total: -5, correct: NaN, wrong: 2.8 })).toEqual({
      total: 0,
      correct: 0,
      wrong: 0,
    })
  })

  it('正确数不超过总数，错题数不超过剩余', () => {
    expect(normalizeStats({ total: 3, correct: 10, wrong: 10 })).toEqual({
      total: 3,
      correct: 3,
      wrong: 0,
    })
    expect(normalizeStats({ total: 5, correct: 2, wrong: 99 })).toEqual({
      total: 5,
      correct: 2,
      wrong: 3,
    })
  })

  it('保留合法数据', () => {
    expect(normalizeStats({ total: 10, correct: 7, wrong: 3 })).toEqual({
      total: 10,
      correct: 7,
      wrong: 3,
    })
  })
})

describe('loadStats / saveStats', () => {
  it('无数据返回空统计', () => {
    expect(loadStats(memoryStorage())).toEqual(EMPTY_STATS)
  })

  it('损坏 JSON 返回空统计', () => {
    expect(loadStats(memoryStorage({ [STATS_KEY]: '{broken' }))).toEqual(EMPTY_STATS)
  })

  it('保存后可读回', () => {
    const storage = memoryStorage()
    const stats: Stats = { total: 4, correct: 3, wrong: 1 }
    saveStats(stats, storage)
    expect(loadStats(storage)).toEqual(stats)
  })

  it('存储抛错时静默降级', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    } as unknown as Storage
    expect(loadStats(storage)).toEqual(EMPTY_STATS)
    expect(() => saveStats(EMPTY_STATS, storage)).not.toThrow()
  })
})

describe('addResult', () => {
  it('答对累加 correct', () => {
    expect(addResult({ total: 1, correct: 1, wrong: 0 }, true)).toEqual({
      total: 2,
      correct: 2,
      wrong: 0,
    })
  })

  it('答错累加 wrong', () => {
    expect(addResult({ total: 1, correct: 1, wrong: 0 }, false)).toEqual({
      total: 2,
      correct: 1,
      wrong: 1,
    })
  })
})

describe('accuracy', () => {
  it('未作答返回 0', () => {
    expect(accuracy(0, 0)).toBe(0)
  })

  it('四舍五入为整数百分比', () => {
    expect(accuracy(1, 3)).toBe(33)
    expect(accuracy(2, 3)).toBe(67)
    expect(accuracy(3, 3)).toBe(100)
  })
})
