/**
 * 练习会话的纯函数工具：洗牌、进度、自定义题库转换
 */

import type { Question } from './questions'
import type { CustomQuestion } from './customQuestions'

export type PracticeMode = 'chapter' | 'random' | 'custom'

/** Fisher–Yates 洗牌，返回新数组 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/** 自定义题 → 练习题（补齐教材归属与兜底题干） */
export function customToQuestions(items: readonly CustomQuestion[]): Question[] {
  return items.map(item => ({
    id: item.id,
    book: '自定义',
    chapter: '自定义',
    section: '自定义',
    description: item.description || `请写出：${item.answer}`,
    answer: item.answer,
  }))
}

/** 进度百分比：已答题数（含刚判定的当前题）/ 总题数 */
export function progressPercent(index: number, total: number, judged: boolean): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, ((index + (judged ? 1 : 0)) / total) * 100))
}
