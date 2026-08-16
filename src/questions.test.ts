import { describe, expect, it } from 'vitest'
import { QUESTIONS, getBooks, getChapters, getSections, getSectionQuestions } from './questions'
import { tryParseEquation } from './engine/parse'
import { judge } from './engine/judge'

describe('题库校验', () => {
  it('题库非空且 id 唯一', () => {
    expect(QUESTIONS.length).toBeGreaterThan(0)
    const ids = new Set(QUESTIONS.map(q => q.id))
    expect(ids.size).toBe(QUESTIONS.length)
  })

  it('每道题描述与答案非空', () => {
    for (const q of QUESTIONS) {
      expect(q.description.trim(), `题 ${q.id} 描述为空`).not.toBe('')
      expect(q.answer.trim(), `题 ${q.id} 答案为空`).not.toBe('')
    }
  })

  it('每道题具有有效的教材章节归属', () => {
    for (const q of QUESTIONS) {
      expect(q.book.trim(), `题 ${q.id} 教材为空`).not.toBe('')
      expect(q.chapter.trim(), `题 ${q.id} 章为空`).not.toBe('')
      expect(q.section.trim(), `题 ${q.id} 节为空`).not.toBe('')
    }
    // 辅助函数闭合性：每道题都能通过三级导航找到
    for (const book of getBooks()) {
      const chapters = getChapters(book)
      expect(chapters.length, `教材「${book}」没有章节`).toBeGreaterThan(0)
      for (const chapter of chapters) {
        const sections = getSections(book, chapter)
        expect(sections.length, `章「${chapter}」没有节`).toBeGreaterThan(0)
        for (const section of sections) {
          const qs = getSectionQuestions(book, chapter, section)
          expect(qs.length, `节「${section}」没有题目`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('章节练习教材（当前阶段：必修一先行完整覆盖）', () => {
    // 迭代节奏：当前轮次只完整覆盖必修第一册，其余教材后续轮次补充
    // 一旦某教材入库，其章节结构必须闭合（由上一测试保证）
    const b1 = QUESTIONS.filter(q => q.book === '必修第一册')
    expect(b1.length, `必修第一册题量 ${b1.length} 不足`).toBeGreaterThanOrEqual(60)
    // 必修一四大章节均需有题
    const chapters = getChapters('必修第一册')
    expect(chapters).toContain('第一章 物质及其变化')
    expect(chapters).toContain('第二章 海水中的重要元素——钠和氯')
    expect(chapters).toContain('第三章 铁 金属材料')
    expect(chapters).toContain('第四章 物质结构 元素周期律')
  })

  it('章节练习教材（必修第二册完整覆盖）', () => {
    const b2 = QUESTIONS.filter(q => q.book === '必修第二册')
    expect(b2.length, `必修第二册题量 ${b2.length} 不足`).toBeGreaterThanOrEqual(90)
    // 必修二四大章节均需有题
    const chapters = getChapters('必修第二册')
    expect(chapters).toContain('第五章 化工生产中的重要非金属元素')
    expect(chapters).toContain('第六章 化学反应与能量')
    expect(chapters).toContain('第七章 有机化合物')
    expect(chapters).toContain('第八章 化学与可持续发展')
    // 第六章需含已有的合成氨题（id 10）
    const nh3 = b2.find(q => q.id === 10)
    expect(nh3).toBeDefined()
  })

  it('章节练习教材（选择性必修3 完整覆盖）', () => {
    const b3 = QUESTIONS.filter(q => q.book === '选择性必修3 有机化学基础')
    expect(b3.length, `选择性必修3 题量 ${b3.length} 不足`).toBeGreaterThanOrEqual(44)
    // 选择性必修3 四、五章均需有题（第四章 生物大分子 / 第五章 合成高分子）
    const chapters = getChapters('选择性必修3 有机化学基础')
    expect(chapters).toContain('第四章 生物大分子')
    expect(chapters).toContain('第五章 合成高分子')
  })

  it('章节练习教材（选择性必修2 第三章 晶体结构与性质）', () => {
    const x2 = QUESTIONS.filter(q => q.book === '选择性必修2 物质结构与性质')
    expect(x2.length, `选择性必修2 题量 ${x2.length} 不足`).toBeGreaterThanOrEqual(8)
    // 第三章（晶体结构与性质）需有题：配合物与晶体制备
    const chapters = getChapters('选择性必修2 物质结构与性质')
    expect(chapters).toContain('第三章 晶体结构与性质')
  })

  it('答案不重复（同教材同章内无重复答案）', () => {
    const seen = new Map<string, number>()
    for (const q of QUESTIONS) {
      const key = q.answer.replace(/\s+/g, '')
      const prev = seen.get(key)
      expect(prev, `题 ${q.id} 与题 ${prev} 答案重复「${q.answer}」`).toBeUndefined()
      seen.set(key, q.id)
    }
  })

  it('每道题答案可解析', () => {
    for (const q of QUESTIONS) {
      const r = tryParseEquation(q.answer)
      expect(r.error, `题 ${q.id}「${q.answer}」解析失败: ${r.error}`).toBeUndefined()
    }
  })

  it('每道题答案自判为正确（judge 自检通过）', () => {
    for (const q of QUESTIONS) {
      const j = judge(q.answer, q.answer)
      expect(j.correct, `题 ${q.id}「${q.answer}」自判失败: ${j.messages.join('; ')}`).toBe(true)
    }
  })

  it('每道题标准答案能渲染为 LaTeX', async () => {
    const { eqToLatex } = await import('./engine/latex')
    for (const q of QUESTIONS) {
      const r = tryParseEquation(q.answer)
      expect(r.eq).toBeDefined()
      expect(() => eqToLatex(r.eq!)).not.toThrow()
    }
  })
})
