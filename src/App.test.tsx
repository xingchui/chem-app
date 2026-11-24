import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { getBooks, getChapters, getSections, getSectionQuestions } from './questions'

// jsdom 环境下 localStorage 未必可用，显式提供内存实现
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => {
    store.clear()
  },
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size
  },
})

const book = getBooks()[0]
const chapter = getChapters(book)[0]
const section = getSections(book, chapter)[0]
const question = getSectionQuestions(book, chapter, section)[0]

/** 把中文名称安全地放进正则，避免括号等字符被当作元字符 */
function namePattern(name: string): RegExp {
  return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}

beforeEach(() => {
  store.clear()
})

afterEach(() => {
  cleanup()
})

describe('App 冒烟流程', () => {
  it('章节选择 → 练习 → 提交正确答案 → 只读 → 完成', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /章节练习/ }))
    fireEvent.click(screen.getByRole('button', { name: namePattern(book) }))
    fireEvent.click(screen.getByRole('button', { name: namePattern(chapter) }))
    fireEvent.click(screen.getByRole('button', { name: namePattern(section) }))

    expect(screen.getByText(question.description)).toBeTruthy()

    const textarea = screen.getByLabelText('化学方程式输入') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: question.answer } })
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }))

    expect(screen.getByText('✓ 回答正确！')).toBeTruthy()
    expect(textarea.readOnly).toBe(true)
    // 判题后快捷栏禁用，避免改写已提交答案
    expect((screen.getByTitle('气体') as HTMLButtonElement).disabled).toBe(true)

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('chem_app_stats')!)).toEqual({
        total: 1,
        correct: 1,
        wrong: 0,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(screen.getByText('练习完成')).toBeTruthy()
    expect(screen.getByText(/答对/).textContent).toContain('1')
  })
})
