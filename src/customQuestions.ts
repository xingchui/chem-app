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

/** 生成一个当前未被占用的 id（毫秒时间戳，冲突时递增） */
function nextUnusedId(used: Set<number>): number {
  let id = Date.now()
  while (used.has(id)) id++
  return id
}

/** 确保题目 id 唯一；冲突或非法 id 会重新分配 */
export function assignUniqueIds(
  questions: readonly CustomQuestion[],
  reserved: Iterable<number> = [],
): CustomQuestion[] {
  const used = new Set<number>(reserved)
  return questions.map(q => {
    let id = Number.isFinite(q.id) && q.id > 0 ? Math.floor(q.id) : nextUnusedId(used)
    while (used.has(id)) id = nextUnusedId(used)
    used.add(id)
    return { ...q, id }
  })
}

/** 合并两批题目，保证 id 不冲突 */
export function mergeCustomQuestions(
  existing: readonly CustomQuestion[],
  incoming: readonly CustomQuestion[],
): CustomQuestion[] {
  return [
    ...existing,
    ...assignUniqueIds(incoming, existing.map(q => q.id)),
  ]
}

/** 从 localStorage 加载自定义题库 */
export function loadCustomQuestions(): CustomQuestion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    const valid = data.filter(
      (q: unknown): q is CustomQuestion =>
        typeof q === 'object' &&
        q !== null &&
        typeof (q as CustomQuestion).answer === 'string' &&
        (q as CustomQuestion).answer.trim() !== '' &&
        typeof (q as CustomQuestion).id === 'number' &&
        tryParseEquation((q as CustomQuestion).answer).eq !== undefined,
    )
    // 历史数据可能包含重复 id，加载时修复，避免 React key 冲突与误删
    return assignUniqueIds(valid)
  } catch {
    return []
  }
}

/** 保存自定义题库到 localStorage */
export function saveCustomQuestions(questions: CustomQuestion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions))
}

/** 逐行解析文本，返回每行的解析结果；支持「描述 | 方程式」补充题干 */
export function parseCustomText(text: string): ParseResult[] {
  const lines = text.split('\n').filter(l => l.trim())
  const used = new Set<number>()
  return lines.map((line, i) => {
    const trimmed = line.trim()
    const sep = trimmed.search(/[|｜]/)
    const description = sep >= 0 ? trimmed.slice(0, sep).trim() : ''
    const answer = sep >= 0 ? trimmed.slice(sep + 1).trim() : trimmed
    const r = tryParseEquation(answer)
    if (r.eq) {
      const id = nextUnusedId(used)
      used.add(id)
      return {
        line: i + 1,
        text: trimmed,
        success: true,
        question: { id, answer, description },
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
  const imported = data.map((q: Record<string, unknown>, i: number) => {
    const answer = typeof q.answer === 'string' ? q.answer.trim() : ''
    if (!answer) throw new Error(`第 ${i + 1} 条缺少 answer`)
    const parsed = tryParseEquation(answer)
    if (!parsed.eq) throw new Error(`第 ${i + 1} 条方程式无法解析：${parsed.error ?? '格式错误'}`)
    return {
      id: typeof q.id === 'number' ? q.id : Date.now() + i,
      answer,
      description: typeof q.description === 'string' ? q.description : '',
    }
  })
  // 导入文件内部也可能有重复 id，统一修复
  return assignUniqueIds(imported)
}
