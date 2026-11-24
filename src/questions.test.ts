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

  it('章节练习教材（九年级上册覆盖）', () => {
    const j9a = QUESTIONS.filter(q => q.book === '九年级上册')
    expect(j9a.length, `九年级上册题量 ${j9a.length} 不足`).toBeGreaterThanOrEqual(15)
    const chapters = getChapters('九年级上册')
    expect(chapters).toContain('第一单元 走进化学世界')
    expect(chapters).toContain('第二单元 我们周围的空气')
    expect(chapters).toContain('第三单元 物质构成的奥秘')
    expect(chapters).toContain('第四单元 自然界的水')
    expect(chapters).toContain('第五单元 化学方程式')
    expect(chapters).toContain('第六单元 碳和碳的氧化物')
    expect(chapters).toContain('第七单元 燃料及其利用')
  })

  it('章节练习教材（九年级下册覆盖）', () => {
    const j9b = QUESTIONS.filter(q => q.book === '九年级下册')
    expect(j9b.length, `九年级下册题量 ${j9b.length} 不足`).toBeGreaterThanOrEqual(19)
    const chapters = getChapters('九年级下册')
    expect(chapters).toContain('第八单元 金属和金属材料')
    expect(chapters).toContain('第九单元 溶液')
    expect(chapters).toContain('第十单元 酸和碱')
    expect(chapters).toContain('第十一单元 盐 化肥')
    expect(chapters).toContain('第十二单元 化学与生活')
  })

  it('章节练习教材（必修第一册完整覆盖）', () => {
    // 一旦某教材入库，其章节结构必须闭合（由上一测试保证）
    const b1 = QUESTIONS.filter(q => q.book === '必修第一册')
    expect(b1.length, `必修第一册题量 ${b1.length} 不足`).toBeGreaterThanOrEqual(83)
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
    expect(b3.length, `选择性必修3 题量 ${b3.length} 不足`).toBeGreaterThanOrEqual(52)
    // 选择性必修3 第一章及第四、五章均需有题
    const chapters = getChapters('选择性必修3 有机化学基础')
    expect(chapters).toContain('第一章 有机化合物的结构特点与研究方法')
    expect(chapters).toContain('第四章 生物大分子')
    expect(chapters).toContain('第五章 合成高分子')
  })

  it('章节练习教材（选择性必修2 第一~三章覆盖）', () => {
    const x2 = QUESTIONS.filter(q => q.book === '选择性必修2 物质结构与性质')
    expect(x2.length, `选择性必修2 题量 ${x2.length} 不足`).toBeGreaterThanOrEqual(34)
    // 第一、二章（原子结构、分子结构）与第三章（晶体结构）均需有题
    const chapters = getChapters('选择性必修2 物质结构与性质')
    expect(chapters).toContain('第一章 原子结构与性质')
    expect(chapters).toContain('第二章 分子结构与性质')
    expect(chapters).toContain('第三章 晶体结构与性质')
  })

  it('章节按教材序号排序（而非题库插入顺序）', () => {
    expect(getChapters('九年级上册')).toEqual([
      '第一单元 走进化学世界',
      '第二单元 我们周围的空气',
      '第三单元 物质构成的奥秘',
      '第四单元 自然界的水',
      '第五单元 化学方程式',
      '第六单元 碳和碳的氧化物',
      '第七单元 燃料及其利用',
    ])
    expect(getChapters('选择性必修2 物质结构与性质')).toEqual([
      '第一章 原子结构与性质',
      '第二章 分子结构与性质',
      '第三章 晶体结构与性质',
    ])
    expect(getSections('必修第一册', '第四章 物质结构 元素周期律')).toEqual([
      '第一节 原子结构与元素周期表',
      '第二节 元素周期律',
      '第三节 化学键',
    ])
    expect(getSections('九年级下册', '第十一单元 盐 化肥')).toEqual([
      '课题1 生活中常见的盐',
      '课题2 化学肥料',
    ])
  })

  it('答案全局不重复', () => {
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
