/**
 * 自定义题库 — 数据模型、localStorage 存储、文本批量解析、JSON 导入导出
 */

import { tryParseEquation } from './engine/parse'

export interface CustomQuestion {
  id: number
  answer: string
  description: string
}

export interface ParseResult {
  line: number
  text: string
  success: boolean
  error?: string
  question?: CustomQuestion
}

const STORAGE_KEY = 'chem-custom-questions'

/** 从 localStorage 加载自定义题库 */
export function loadCustomQuestions(): CustomQuestion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(
      (q: unknown): q is CustomQuestion =>
        typeof q === 'object' &&
        q !== null &&
        typeof (q as CustomQuestion).answer === 'string' &&
        typeof (q as CustomQuestion).id === 'number',
    )
  } catch {
    return []
  }
}

/** 保存自定义题库到 localStorage */
export function saveCustomQuestions(questions: CustomQuestion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions))
}

/** 逐行解析文本，返回每行的解析结果 */
export function parseCustomText(text: string): ParseResult[] {
  const lines = text.split('\n').filter(l => l.trim())
  return lines.map((line, i) => {
    const trimmed = line.trim()
    const r = tryParseEquation(trimmed)
    if (r.eq) {
      return {
        line: i + 1,
        text: trimmed,
        success: true,
        question: { id: Date.now() + i, answer: trimmed, description: '' },
      }
    }
    return {
      line: i + 1,
      text: trimmed,
      success: false,
      error: r.error ?? '解析失败',
    }
  })
}

/** 导出为 JSON 字符串 */
export function exportToJSON(questions: CustomQuestion[]): string {
  return JSON.stringify(questions, null, 2)
}

/** 从 JSON 字符串导入 */
export function importFromJSON(json: string): CustomQuestion[] {
  const data = JSON.parse(json)
  if (!Array.isArray(data)) throw new Error('JSON 顶层应为数组')
  return data.map((q: Record<string, unknown>, i: number) => ({
    id: typeof q.id === 'number' ? q.id : Date.now() + i,
    answer: typeof q.answer === 'string' ? q.answer : '',
    description: typeof q.description === 'string' ? q.description : '',
  }))
}
