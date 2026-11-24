import { useEffect, useMemo, useRef, useState } from 'react'
import { tryParseEquation } from './engine/parse'
import { eqToLatex } from './engine/latex'
import { judge, type Judgement } from './engine/judge'
import { QUESTIONS, getSectionQuestions } from './questions'
import {
  type CustomQuestion,
  loadCustomQuestions,
  saveCustomQuestions,
} from './customQuestions'
import { customToQuestions, shuffle, type PracticeMode } from './practice'
import { addResult, loadStats, saveStats, type Stats } from './stats'
import { CTRL_MAP } from './shortcuts'
import { renderLatex } from './renderLatex'
import { usePreview } from './usePreview'
import { HomeView } from './views/HomeView'
import { BookSelectView } from './views/BookSelectView'
import { ChapterSelectView } from './views/ChapterSelectView'
import { SectionSelectView } from './views/SectionSelectView'
import { PracticeView } from './views/PracticeView'
import { DoneView } from './views/DoneView'
import { StatsView } from './views/StatsView'
import { CustomBankView } from './views/CustomBankView'
import './App.css'

type View =
  | 'home'
  | 'select-book'
  | 'select-chapter'
  | 'select-section'
  | 'practice'
  | 'stats'
  | 'custom-bank'

function App() {
  const [view, setView] = useState<View>('home')
  const [mode, setMode] = useState<PracticeMode>('random')
  const [selBook, setSelBook] = useState('')
  const [selChapter, setSelChapter] = useState('')
  const [selSection, setSelSection] = useState('')
  const [questions, setQuestions] = useState(QUESTIONS)
  const [qIndex, setQIndex] = useState(0)
  const [input, setInput] = useState('')
  const [results, setResults] = useState<(boolean | undefined)[]>(() =>
    QUESTIONS.map(() => undefined),
  )
  const [judgement, setJudgement] = useState<Judgement | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [stats, setStats] = useState<Stats>(loadStats)
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(loadCustomQuestions)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const q = questions[qIndex]
  const preview = usePreview(input)
  const correctCount = results.filter(Boolean).length
  const finished = qIndex >= questions.length

  const answerHtml = useMemo(() => {
    if (finished || !q) return ''
    const result = tryParseEquation(q.answer)
    return result.eq ? renderLatex(eqToLatex(result.eq)) : ''
  }, [q, finished])

  // 进入练习/切题后自动聚焦输入框
  useEffect(() => {
    if (view === 'practice' && !finished) inputRef.current?.focus()
  }, [view, qIndex, finished])

  // 统计持久化（saveStats 内部已处理存储不可用）
  useEffect(() => {
    saveStats(stats)
  }, [stats])

  function resetQuestionState(len: number) {
    setInput('')
    setJudgement(null)
    setShowHint(false)
    setResults(Array(len).fill(undefined))
  }

  /** 随机练习：全题库洗牌 */
  function startRandomPractice() {
    setMode('random')
    setQuestions(shuffle(QUESTIONS))
    setQIndex(0)
    resetQuestionState(QUESTIONS.length)
    setView('practice')
  }

  /** 章节练习：按（教材·章·节）选取题目 */
  function startSectionPractice(book: string, chapter: string, section: string) {
    const sectionQuestions = getSectionQuestions(book, chapter, section)
    setMode('chapter')
    setSelBook(book)
    setSelChapter(chapter)
    setSelSection(section)
    setQuestions(sectionQuestions)
    setQIndex(0)
    resetQuestionState(sectionQuestions.length)
    setView('practice')
  }

  /** 自定义练习：使用自定义题库 */
  function startCustomPractice() {
    if (customQuestions.length === 0) {
      window.alert('请先添加自定义题目')
      return
    }
    const custom = customToQuestions(customQuestions)
    setMode('custom')
    setQuestions(shuffle(custom))
    setQIndex(0)
    resetQuestionState(custom.length)
    setView('practice')
  }

  /** 再来一轮：章节练习重练本节，随机/自定义练习重新洗牌 */
  function restart() {
    if (mode === 'chapter') {
      startSectionPractice(selBook, selChapter, selSection)
    } else if (mode === 'custom') {
      startCustomPractice()
    } else {
      startRandomPractice()
    }
  }

  function goTo(index: number) {
    setQIndex(index)
    setInput('')
    setJudgement(null)
    setShowHint(false)
  }

  function submit() {
    if (!q || !input.trim() || judgement || preview.error) return
    let result: Judgement
    try {
      result = judge(input, q.answer)
    } catch {
      window.alert('标准答案无法解析，请检查自定义题库')
      return
    }
    setJudgement(result)
    setResults(prev => {
      const next = [...prev]
      next[qIndex] = result.correct
      return next
    })
    setStats(prev => addResult(prev, result.correct))
  }

  function skip() {
    if (judgement || !q) return
    setJudgement({
      correct: false,
      arrowOk: false,
      condOk: false,
      termChecks: [],
      balance: [],
      messages: ['已跳过本题'],
    })
    setResults(prev => {
      const next = [...prev]
      next[qIndex] = false
      return next
    })
    setStats(prev => addResult(prev, false))
  }

  function nextQuestion() {
    if (qIndex + 1 >= questions.length) {
      setQIndex(questions.length)
    } else {
      goTo(qIndex + 1)
    }
  }

  function insertSymbol(sym: string) {
    if (judgement) return
    const el = inputRef.current
    if (!el) {
      setInput(v => v + sym)
      return
    }
    const start = el.selectionStart ?? input.length
    const end = el.selectionEnd ?? input.length
    const next = input.slice(0, start) + sym + input.slice(end)
    setInput(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + sym.length
    })
  }

  function clearStats() {
    if (window.confirm('确定要清空所有学习统计吗？')) {
      setStats({ total: 0, correct: 0, wrong: 0 })
    }
  }

  function handleCustomSave(next: CustomQuestion[]): boolean {
    try {
      saveCustomQuestions(next)
      setCustomQuestions(next)
      return true
    } catch {
      window.alert('保存失败：本地存储空间不足或被禁用')
      return false
    }
  }

  // 键盘监听只注册一次，通过 ref 读取最新处理函数，避免每次渲染都解绑/重绑
  const keyHandlers = useRef({ submit, insertSymbol, nextQuestion })
  keyHandlers.current = { submit, insertSymbol, nextQuestion }

  // ── 键盘：Enter 提交/下一题；Ctrl+数字 插入符号 ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 中文输入法组合期间不响应 Enter，避免把确认候选词当成提交
      if (e.isComposing || e.keyCode === 229) return
      if (view !== 'practice' || finished) return
      if (e.ctrlKey) {
        const sym = CTRL_MAP[e.key]
        if (sym) {
          e.preventDefault()
          if (!judgement) keyHandlers.current.insertSymbol(sym)
          return
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (judgement) keyHandlers.current.nextQuestion()
        else keyHandlers.current.submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, finished, judgement])

  const modeLabel =
    mode === 'random'
      ? '随机练习'
      : mode === 'custom'
        ? '自定义练习'
        : `${selBook} · ${selChapter} · ${selSection}`

  if (view === 'home') {
    return (
      <HomeView
        onChapter={() => setView('select-book')}
        onRandom={startRandomPractice}
        onStats={() => setView('stats')}
        onCustomBank={() => setView('custom-bank')}
        onCustomPractice={startCustomPractice}
      />
    )
  }

  if (view === 'select-book') {
    return (
      <BookSelectView
        onSelect={book => {
          setSelBook(book)
          setSelChapter('')
          setSelSection('')
          setView('select-chapter')
        }}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'select-chapter') {
    return (
      <ChapterSelectView
        book={selBook}
        onSelect={chapter => {
          setSelChapter(chapter)
          setSelSection('')
          setView('select-section')
        }}
        onBack={() => setView('select-book')}
      />
    )
  }

  if (view === 'select-section') {
    return (
      <SectionSelectView
        book={selBook}
        chapter={selChapter}
        onSelect={section => startSectionPractice(selBook, selChapter, section)}
        onBack={() => setView('select-chapter')}
      />
    )
  }

  if (view === 'custom-bank') {
    return (
      <CustomBankView
        questions={customQuestions}
        onSave={handleCustomSave}
        onBack={() => setView('home')}
      />
    )
  }

  if (view === 'stats') {
    return <StatsView stats={stats} onClear={clearStats} onBack={() => setView('home')} />
  }

  if (finished) {
    return (
      <DoneView
        modeLabel={modeLabel}
        correctCount={correctCount}
        total={questions.length}
        onRestart={restart}
        onHome={() => setView('home')}
      />
    )
  }

  if (!q) return null

  return (
    <PracticeView
      question={q}
      index={qIndex}
      total={questions.length}
      mode={mode}
      modeLabel={modeLabel}
      input={input}
      preview={preview}
      judgement={judgement}
      answerHtml={answerHtml}
      showHint={showHint}
      inputRef={inputRef}
      onInput={setInput}
      onSubmit={submit}
      onSkip={skip}
      onNext={nextQuestion}
      onBack={() => setView('home')}
      onToggleHint={() => setShowHint(v => !v)}
      onInsertSymbol={insertSymbol}
    />
  )
}

export default App
