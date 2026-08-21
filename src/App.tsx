import { useEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { tryParseEquation } from './engine/parse'
import { eqToLatex } from './engine/latex'
import { judge, type Judgement } from './engine/judge'
import {
  QUESTIONS,
  getBooks,
  getChapters,
  getSections,
  getSectionQuestions,
} from './questions'
import {
  type CustomQuestion,
  type ParseResult,
  loadCustomQuestions,
  saveCustomQuestions,
  parseCustomText,
  exportToJSON,
  importFromJSON,
} from './customQuestions'
import './App.css'

// ── 本地统计 ──
const STATS_KEY = 'chem_app_stats'
interface Stats {
  total: number
  correct: number
  wrong: number
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Partial<Stats>
      if (typeof s.total === 'number') {
        return { total: s.total, correct: s.correct ?? 0, wrong: s.wrong ?? 0 }
      }
    }
  } catch {
    /* 忽略损坏数据 */
  }
  return { total: 0, correct: 0, wrong: 0 }
}

// ── 快捷符号栏（参考版对齐） ──
const SHORTCUT_SYMBOLS: { sym: string; label: string }[] = [
  { sym: '↑', label: '气体' },
  { sym: '↓', label: '沉淀' },
  { sym: '=', label: '等号' },
  { sym: '⇌', label: '可逆' },
  { sym: '≡', label: '三键' },
  { sym: '△', label: '加热' },
  { sym: '₂', label: '下标' },
  { sym: '⁺', label: '正电荷' },
  { sym: '⁻', label: '负电荷' },
  { sym: '℃', label: '温度' },
]
const CTRL_MAP: Record<string, string> = {
  '1': '↑', '2': '↓', '3': '=', '4': '⇌', '5': '≡',
  '6': '△', '7': '₂', '8': '⁺', '9': '⁻', '0': '℃',
}

type View = 'home' | 'select-book' | 'select-chapter' | 'select-section' | 'practice' | 'stats' | 'custom-bank'
type Mode = 'chapter' | 'random' | 'custom'

function renderLatex(latex: string): string {
  return katex.renderToString(latex, { throwOnError: false, displayMode: true })
}

/** 输入 → 实时 LaTeX 预览（解析失败给出错误消息） */
function usePreview(src: string): { html?: string; error?: string } {
  return useMemo(() => {
    if (!src.trim()) return {}
    const r = tryParseEquation(src)
    if (r.error) return { error: r.error }
    if (r.eq) return { html: renderLatex(eqToLatex(r.eq)) }
    return { error: '解析失败' }
  }, [src])
}

/** 原地洗牌（Fisher–Yates） */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function App() {
  const [view, setView] = useState<View>('home')
  const [mode, setMode] = useState<Mode>('random')
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // ── 自定义题库 ──
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(() => loadCustomQuestions())
  const [bankText, setBankText] = useState('')
  const [parseResults, setParseResults] = useState<ParseResult[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  const q = questions[qIndex]
  const preview = usePreview(input)
  const correctCount = results.filter(Boolean).length
  const answeredCount = results.filter(r => r !== undefined).length
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
  const finished = qIndex >= questions.length

  const answerHtml = useMemo(() => {
    if (finished || !q) return ''
    const r = tryParseEquation(q.answer)
    return r.eq ? renderLatex(eqToLatex(r.eq)) : ''
  }, [q, finished])

  // ── 统计持久化 ──
  useEffect(() => {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats))
    } catch {
      /* 存储不可用时忽略 */
    }
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
    const qs = getSectionQuestions(book, chapter, section)
    setMode('chapter')
    setSelBook(book)
    setSelChapter(chapter)
    setSelSection(section)
    setQuestions(qs)
    setQIndex(0)
    resetQuestionState(qs.length)
    setView('practice')
  }

  /** 自定义练习：使用自定义题库 */
  function startCustomPractice() {
    if (customQuestions.length === 0) {
      window.alert('请先添加自定义题目')
      return
    }
    const qs = customQuestions.map(q => ({
      ...q,
      book: '自定义',
      chapter: '自定义',
      section: '自定义',
    }))
    setMode('custom')
    setQuestions(shuffle(qs))
    setQIndex(0)
    resetQuestionState(qs.length)
    setView('practice')
  }

  /** 再来一轮：章节练习重练本节，随机练习重新洗牌，自定义练习重新洗牌 */
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
    if (!input.trim()) return
    const j = judge(input, q.answer)
    setJudgement(j)
    const ok = j.correct
    setResults(prev => {
      const next = [...prev]
      next[qIndex] = ok
      return next
    })
    setStats(prev => ({
      total: prev.total + 1,
      correct: prev.correct + (ok ? 1 : 0),
      wrong: prev.wrong + (ok ? 0 : 1),
    }))
  }

  function skip() {
    // 跳过：计为一次练习（错误），显示正确答案
    setJudgement({ correct: false, arrowOk: false, condOk: false, termChecks: [], balance: [], messages: ['已跳过本题'] })
    setResults(prev => {
      const next = [...prev]
      next[qIndex] = false
      return next
    })
    setStats(prev => ({ total: prev.total + 1, correct: prev.correct, wrong: prev.wrong + 1 }))
  }

  function nextQuestion() {
    if (qIndex + 1 >= questions.length) {
      // 最后一题：进入完成面板（finished = qIndex >= questions.length）
      setQIndex(questions.length)
    } else {
      goTo(qIndex + 1)
    }
  }

  function insertSymbol(sym: string) {
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

  // ── 键盘：Enter 提交/下一题；Ctrl+数字 插入符号 ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey) {
        const sym = CTRL_MAP[e.key]
        if (sym) {
          e.preventDefault()
          insertSymbol(sym)
          return
        }
      }
      if (e.key === 'Enter' && !e.shiftKey && view === 'practice' && !finished) {
        e.preventDefault()
        if (judgement) nextQuestion()
        else submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, finished, judgement, input])

  const totalAccuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
  const modeLabel = mode === 'random' ? '随机练习' : mode === 'custom' ? '自定义练习' : `${selBook} · ${selChapter} · ${selSection}`

  // ── 首页（模式选择） ──
  if (view === 'home') {
    return (
      <main className="app">
        <header className="app-header">
          <h1>化学方程式练习</h1>
          <p>选择练习模式，开始书写化学方程式</p>
        </header>
        <section className="card">
          <h2 className="card-title">选择练习模式</h2>
          <div className="mode-grid">
            <button type="button" className="mode-card" onClick={() => setView('select-book')}>
              <div className="mode-icon">📚</div>
              <h3>章节练习</h3>
              <p>按教材章节选择题目练习</p>
            </button>
            <button type="button" className="mode-card" onClick={startRandomPractice}>
              <div className="mode-icon">🎲</div>
              <h3>随机练习</h3>
              <p>随机抽取方程式挑战</p>
            </button>
            <button type="button" className="mode-card" onClick={() => setView('stats')}>
              <div className="mode-icon">📊</div>
              <h3>学习统计</h3>
              <p>查看学习进度和正确率</p>
            </button>
            <button type="button" className="mode-card" onClick={() => setView('custom-bank')}>
              <div className="mode-icon">✏️</div>
              <h3>自定义题库</h3>
              <p>导入方程式，自定义练习</p>
            </button>
            <button type="button" className="mode-card" onClick={startCustomPractice}>
              <div className="mode-icon">🎯</div>
              <h3>自定义练习</h3>
              <p>练习自定义题库中的方程式</p>
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── 选择教材（一级） ──
  if (view === 'select-book') {
    const books = getBooks()
    return (
      <main className="app">
        <header className="app-header">
          <h1>化学方程式练习</h1>
          <p>选择教材</p>
        </header>
        <section className="card">
          <h2 className="card-title">选择教材</h2>
          <div className="select-list">
            {books.map(book => {
              const chapters = getChapters(book)
              const count = QUESTIONS.filter(q => q.book === book).length
              return (
                <button
                  key={book}
                  type="button"
                  className="select-item"
                  onClick={() => {
                    setSelBook(book)
                    setSelChapter('')
                    setView('select-chapter')
                  }}
                >
                  <div className="select-item-text">
                    <span className="select-item-title">{book}</span>
                    <span className="select-item-meta">
                      {chapters.length} 章 · {count} 题
                    </span>
                  </div>
                  <span className="select-item-arrow">→</span>
                </button>
              )
            })}
          </div>
          <div className="button-group">
            <button type="button" className="btn btn-secondary" onClick={() => setView('home')}>
              返回
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── 选择章（二级） ──
  if (view === 'select-chapter') {
    const chapters = getChapters(selBook)
    return (
      <main className="app">
        <header className="app-header">
          <h1>化学方程式练习</h1>
          <p>{selBook}</p>
        </header>
        <section className="card">
          <h2 className="card-title">选择章</h2>
          <div className="select-list">
            {chapters.map(chapter => {
              const sections = getSections(selBook, chapter)
              const count = QUESTIONS.filter(q => q.book === selBook && q.chapter === chapter).length
              return (
                <button
                  key={chapter}
                  type="button"
                  className="select-item"
                  onClick={() => {
                    setSelChapter(chapter)
                    setView('select-section')
                  }}
                >
                  <div className="select-item-text">
                    <span className="select-item-title">{chapter}</span>
                    <span className="select-item-meta">
                      {sections.length} 节 · {count} 题
                    </span>
                  </div>
                  <span className="select-item-arrow">→</span>
                </button>
              )
            })}
          </div>
          <div className="button-group">
            <button type="button" className="btn btn-secondary" onClick={() => setView('select-book')}>
              返回
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── 选择节（三级） ──
  if (view === 'select-section') {
    const sections = getSections(selBook, selChapter)
    return (
      <main className="app">
        <header className="app-header">
          <h1>化学方程式练习</h1>
          <p>
            {selBook} · {selChapter}
          </p>
        </header>
        <section className="card">
          <h2 className="card-title">选择节</h2>
          <div className="select-list">
            {sections.map(section => {
              const count = getSectionQuestions(selBook, selChapter, section).length
              return (
                <button
                  key={section}
                  type="button"
                  className="select-item"
                  onClick={() => startSectionPractice(selBook, selChapter, section)}
                >
                  <div className="select-item-text">
                    <span className="select-item-title">{section}</span>
                    <span className="select-item-meta">{count} 题</span>
                  </div>
                  <span className="select-item-arrow">→</span>
                </button>
              )
            })}
          </div>
          <div className="button-group">
            <button type="button" className="btn btn-secondary" onClick={() => setView('select-chapter')}>
              返回
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── 自定义题库管理视图 ──
  if (view === 'custom-bank') {
    function handleParse() {
      if (!bankText.trim()) return
      setParseResults(parseCustomText(bankText))
    }

    function handleSave() {
      const successItems = parseResults.filter(r => r.success && r.question)
      if (successItems.length === 0) {
        window.alert('没有可保存的题目')
        return
      }
      const newQuestions = successItems.map(r => r.question!)
      const updated = [...customQuestions, ...newQuestions]
      saveCustomQuestions(updated)
      setCustomQuestions(updated)
      setBankText('')
      setParseResults([])
      window.alert(`已保存 ${newQuestions.length} 道题目`)
    }

    function handleDelete(id: number) {
      const updated = customQuestions.filter(q => q.id !== id)
      saveCustomQuestions(updated)
      setCustomQuestions(updated)
    }

    function handleClearAll() {
      if (!window.confirm('确定要清空所有自定义题目吗？')) return
      saveCustomQuestions([])
      setCustomQuestions([])
    }

    function handleImport() {
      try {
        const imported = importFromJSON(importText)
        const updated = [...customQuestions, ...imported]
        saveCustomQuestions(updated)
        setCustomQuestions(updated)
        setImportText('')
        setShowImport(false)
        window.alert(`已导入 ${imported.length} 道题目`)
      } catch (e) {
        window.alert('导入失败：' + (e instanceof Error ? e.message : '格式错误'))
      }
    }

    function handleExport() {
      if (customQuestions.length === 0) {
        window.alert('暂无自定义题目')
        return
      }
      const json = exportToJSON(customQuestions)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '化学方程式自定义题库.json'
      a.click()
      URL.revokeObjectURL(url)
    }

    return (
      <main className="app">
        <header className="app-header">
          <h1>化学方程式练习</h1>
          <p>自定义题库</p>
        </header>
        <section className="card">
          <h2 className="card-title">添加题目</h2>
          <p className="hint-small">每行一个方程式，例：</p>
          <pre className="bank-example">{'2H2 + O2 = 2H2O\nFe2O3 + 3CO =[高温] 2Fe + 3CO2↑\nCH4 + 2O2 =[点燃] CO2 + 2H2O'}</pre>
          <div className="input-area">
            <textarea
              value={bankText}
              onChange={e => setBankText(e.target.value)}
              placeholder="粘贴化学方程式，每行一个..."
              rows={6}
              spellCheck={false}
            />
          </div>
          <div className="button-group">
            <button type="button" className="btn btn-primary" onClick={handleParse} disabled={!bankText.trim()}>
              解析
            </button>
          </div>
          {parseResults.length > 0 && (
            <div className="parse-results">
              <p className="parse-summary">
                成功 <strong>{parseResults.filter(r => r.success).length}</strong> / {parseResults.length} 条
              </p>
              <ul className="parse-list">
                {parseResults.map((r, i) => (
                  <li key={i} className={r.success ? 'parse-ok' : 'parse-err'}>
                    <span className="parse-line">L{r.line}</span>
                    <span className="parse-text">{r.text}</span>
                    {r.error && <span className="parse-error-msg">{r.error}</span>}
                  </li>
                ))}
              </ul>
              <div className="button-group">
                <button type="button" className="btn btn-success" onClick={handleSave} disabled={!parseResults.some(r => r.success)}>
                  保存到题库
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">已保存题目 ({customQuestions.length})</h2>
          {customQuestions.length === 0 ? (
            <p className="hint-small">暂无自定义题目</p>
          ) : (
            <ul className="custom-list">
              {customQuestions.map(q => (
                <li key={q.id} className="custom-item">
                  <span className="custom-text">{q.answer}</span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(q.id)}>
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="button-group">
            <button type="button" className="btn btn-ghost" onClick={() => setShowImport(v => !v)}>
              导入 JSON
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleExport} disabled={customQuestions.length === 0}>
              导出 JSON
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={handleClearAll} disabled={customQuestions.length === 0}>
              清空全部
            </button>
          </div>
          {showImport && (
            <div className="import-area">
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder='粘贴 JSON 数据...'
                rows={4}
                spellCheck={false}
              />
              <div className="button-group">
                <button type="button" className="btn btn-primary" onClick={handleImport} disabled={!importText.trim()}>
                  确认导入
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowImport(false); setImportText('') }}>
                  取消
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="button-group">
          <button type="button" className="btn btn-secondary" onClick={() => setView('home')}>
            返回
          </button>
        </div>
      </main>
    )
  }

  // ── 统计视图 ──
  if (view === 'stats') {
    return (
      <main className="app">
        <header className="app-header">
          <h1>化学方程式练习</h1>
          <p>学习统计</p>
        </header>
        <section className="card">
          <h2 className="card-title">学习统计</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>总练习数</h3>
              <p>{stats.total}</p>
            </div>
            <div className="stat-card">
              <h3>正确数</h3>
              <p>{stats.correct}</p>
            </div>
            <div className="stat-card">
              <h3>正确率</h3>
              <p>{totalAccuracy}%</p>
            </div>
            <div className="stat-card">
              <h3>错题数</h3>
              <p>{stats.wrong}</p>
            </div>
          </div>
          <div className="button-group">
            <button type="button" className="btn btn-secondary" onClick={() => setView('home')}>
              返回
            </button>
            <button type="button" className="btn btn-danger" onClick={clearStats}>
              清空统计
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── 完成面板 ──
  if (finished) {
    return (
      <main className="app">
        <header className="app-header">
          <h1>化学方程式练习</h1>
          <p>{modeLabel}</p>
        </header>
        <section className="card done-card">
          <h2 className="card-title">练习完成</h2>
          <p className="done-score">
            答对 <strong>{correctCount}</strong> / {questions.length} 题
          </p>
          <p className="done-ratio">
            本轮正确率 <strong>{accuracy}%</strong>
          </p>
          <div className="button-group button-group-center">
            <button type="button" className="btn btn-primary" onClick={restart}>
              再来一轮
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setView('home')}>
              返回首页
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── 练习视图 ──
  const progress = ((qIndex + (judgement ? 1 : 0)) / questions.length) * 100
  return (
    <main className="app">
      <header className="app-header">
        <h1>化学方程式练习</h1>
        <p>{modeLabel}</p>
      </header>

      <section className="card practice-card">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="question-info">
          <span className="question-counter">
            第 {qIndex + 1} / {questions.length} 题
          </span>
          <span className="tag">{mode === 'random' ? '随机' : mode === 'custom' ? '自定义' : '章节'}</span>
        </div>

        <div className="question-card">
          <h3 className="question-text">{q.description}</h3>
          <div className="hint">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowHint(v => !v)}
            >
              {showHint ? '收起提示' : '查看提示'}
            </button>
            {showHint && q.hint && <p className="hint-text">{q.hint}</p>}
          </div>

          <div className="input-area">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="请输入化学方程式... 例：Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑"
              rows={3}
              spellCheck={false}
            />
            <div className="shortcut-bar">
              {SHORTCUT_SYMBOLS.map(s => (
                <button
                  key={s.sym}
                  type="button"
                  className="shortcut-btn"
                  title={s.label}
                  onClick={() => insertSymbol(s.sym)}
                >
                  {s.sym}
                  <span className="label">{s.label}</span>
                </button>
              ))}
            </div>
            <div className="hint hint-small">点击按钮或按 Ctrl+数字 快速插入符号，Enter 提交</div>
          </div>

          <div className="preview">
            {preview.error ? (
              <p className="preview-error">解析失败：{preview.error}</p>
            ) : preview.html ? (
              <div className="preview-latex" dangerouslySetInnerHTML={{ __html: preview.html }} />
            ) : (
              <p className="preview-placeholder">实时预览显示在这里</p>
            )}
          </div>

          <div className="button-group">
            {!judgement ? (
              <button type="button" className="btn btn-primary" onClick={submit} disabled={!input.trim()}>
                提交答案
              </button>
            ) : (
              <button type="button" className="btn btn-success" onClick={nextQuestion}>
                {qIndex + 1 >= questions.length ? '完成' : '下一题'}
              </button>
            )}
            <button type="button" className="btn btn-danger" onClick={skip}>
              跳过
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setView('home')}>
              返回
            </button>
          </div>
        </div>
      </section>

      {judgement && (
        <section className={`answer-section ${judgement.correct ? 'answer-correct' : 'answer-wrong'}`}>
          <h4 className="answer-title">
            {judgement.correct ? '✓ 回答正确！' : '✗ 回答错误！'}
          </h4>

          <div className="equation-display correct-equation">
            <span className="eq-label">正确答案：</span>
            <div className="answer-latex" dangerouslySetInnerHTML={{ __html: answerHtml }} />
          </div>

          {judgement.messages.length > 0 && (
            <ul className="result-messages">
              {judgement.messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}

          {!judgement.correct && (
            <div className="equation-display wrong-equation">
              <span className="eq-label">我的输入：</span>
              <span className="user-input-text">{input.trim() || '(空)'}</span>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default App
