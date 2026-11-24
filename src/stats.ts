/**
 * 学习统计 — 数据模型与 localStorage 持久化
 *
 * 独立于 UI，便于单元测试；所有读写失败都静默降级，不阻塞练习。
 */

export interface Stats {
  total: number
  correct: number
  wrong: number
}

export const STATS_KEY = 'chem_app_stats'
export const EMPTY_STATS: Stats = { total: 0, correct: 0, wrong: 0 }

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0
}

/** 校验并修正统计对象：负数/NaN/非数字归零，正确数不超过总数 */
export function normalizeStats(value: unknown): Stats {
  if (!value || typeof value !== 'object') return { ...EMPTY_STATS }
  const raw = value as Partial<Stats>
  const total = toCount(raw.total)
  const correct = Math.min(toCount(raw.correct), total)
  const wrong = Math.min(toCount(raw.wrong), total - correct)
  return { total, correct, wrong }
}

export function loadStats(storage: Storage = localStorage): Stats {
  try {
    const raw = storage.getItem(STATS_KEY)
    return raw ? normalizeStats(JSON.parse(raw)) : { ...EMPTY_STATS }
  } catch {
    return { ...EMPTY_STATS }
  }
}

export function saveStats(stats: Stats, storage: Storage = localStorage): void {
  try {
    storage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    /* 存储不可用（隐私模式/配额满）时忽略 */
  }
}

/** 记录一次练习结果 */
export function addResult(stats: Stats, correct: boolean): Stats {
  return {
    total: stats.total + 1,
    correct: stats.correct + (correct ? 1 : 0),
    wrong: stats.wrong + (correct ? 0 : 1),
  }
}

/** 正确率（0–100 的整数） */
export function accuracy(correct: number, answered: number): number {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0
}
