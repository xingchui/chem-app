import { useState, type ClipboardEvent, type Dispatch, type SetStateAction } from 'react'
import { Page } from '../components/Page'
import {
  type CustomQuestion,
  type ParseResult,
  exportToJSON,
  importFromJSON,
  mergeCustomQuestions,
  parseCustomText,
} from '../customQuestions'

interface CustomBankViewProps {
  questions: CustomQuestion[]
  /** 返回 false 表示持久化失败，视图应保留输入 */
  onSave: (next: CustomQuestion[]) => boolean
  onBack: () => void
}

/** 手动处理粘贴：Electron 下默认粘贴偶发不触发 onChange */
function handlePaste(
  e: ClipboardEvent<HTMLTextAreaElement>,
  setter: Dispatch<SetStateAction<string>>,
): void {
  const text = e.clipboardData?.getData('text') ?? ''
  if (!text) return
  e.preventDefault()
  setter(prev => {
    const el = e.target as HTMLTextAreaElement
    const start = el.selectionStart ?? prev.length
    const end = el.selectionEnd ?? prev.length
    return prev.slice(0, start) + text + prev.slice(end)
  })
}

export function CustomBankView({ questions, onSave, onBack }: CustomBankViewProps) {
  const [bankText, setBankText] = useState('')
  const [parseResults, setParseResults] = useState<ParseResult[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

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
    const updated = mergeCustomQuestions(
      questions,
      successItems.map(r => r.question!),
    )
    if (!onSave(updated)) return
    setBankText('')
    setParseResults([])
    window.alert(`已保存 ${successItems.length} 道题目`)
  }

  function handleDelete(id: number) {
    onSave(questions.filter(q => q.id !== id))
  }

  function handleClearAll() {
    if (!window.confirm('确定要清空所有自定义题目吗？')) return
    onSave([])
  }

  function handleImport() {
    try {
      const imported = importFromJSON(importText)
      const updated = mergeCustomQuestions(questions, imported)
      if (!onSave(updated)) return
      setImportText('')
      setShowImport(false)
      window.alert(`已导入 ${imported.length} 道题目`)
    } catch (e) {
      window.alert('导入失败：' + (e instanceof Error ? e.message : '格式错误'))
    }
  }

  function handleExport() {
    if (questions.length === 0) {
      window.alert('暂无自定义题目')
      return
    }
    const json = exportToJSON(questions)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '化学方程式自定义题库.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // 立即 revoke 在部分浏览器会取消下载，延后释放
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <Page subtitle="自定义题库">
      <section className="card">
        <h2 className="card-title">添加题目</h2>
        <p className="hint-small">每行一个方程式；可用「描述 | 方程式」补充题干，例：</p>
        <pre className="bank-example">
          {'实验室制氧气 | 2KMnO4 =[加热] K2MnO4 + MnO2 + O2↑\n2H2 + O2 = 2H2O\nFe2O3 + 3CO =[高温] 2Fe + 3CO2↑'}
        </pre>
        <div className="input-area">
          <textarea
            value={bankText}
            onChange={e => setBankText(e.target.value)}
            onPaste={e => handlePaste(e, setBankText)}
            aria-label="批量添加方程式"
            placeholder="粘贴化学方程式，每行一个；可用「描述 | 方程式」补充题干..."
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
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSave}
                disabled={!parseResults.some(r => r.success)}
              >
                保存到题库
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">已保存题目 ({questions.length})</h2>
        {questions.length === 0 ? (
          <p className="hint-small">暂无自定义题目</p>
        ) : (
          <ul className="custom-list">
            {questions.map(q => (
              <li key={q.id} className="custom-item">
                <span className="custom-text">
                  {q.description ? `${q.description} | ${q.answer}` : q.answer}
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(q.id)}
                >
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
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleExport}
            disabled={questions.length === 0}
          >
            导出 JSON
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleClearAll}
            disabled={questions.length === 0}
          >
            清空全部
          </button>
        </div>
        {showImport && (
          <div className="import-area">
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              onPaste={e => handlePaste(e, setImportText)}
              aria-label="导入 JSON 数据"
              placeholder="粘贴 JSON 数据..."
              rows={4}
              spellCheck={false}
            />
            <div className="button-group">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!importText.trim()}
              >
                确认导入
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowImport(false)
                  setImportText('')
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="button-group">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          返回
        </button>
      </div>
    </Page>
  )
}
