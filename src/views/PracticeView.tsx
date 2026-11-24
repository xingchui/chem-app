import type { RefObject } from 'react'
import type { Question } from '../questions'
import type { Judgement } from '../engine/judge'
import type { PracticeMode } from '../practice'
import { progressPercent } from '../practice'
import { Latex } from '../components/Latex'
import { Page } from '../components/Page'
import { ShortcutBar } from '../components/ShortcutBar'

interface PreviewState {
  html?: string
  error?: string
}

interface PracticeViewProps {
  question: Question
  index: number
  total: number
  mode: PracticeMode
  modeLabel: string
  input: string
  preview: PreviewState
  judgement: Judgement | null
  answerHtml: string
  showHint: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
  onInput: (value: string) => void
  onSubmit: () => void
  onSkip: () => void
  onNext: () => void
  onBack: () => void
  onToggleHint: () => void
  onInsertSymbol: (sym: string) => void
}

export function PracticeView({
  question,
  index,
  total,
  mode,
  modeLabel,
  input,
  preview,
  judgement,
  answerHtml,
  showHint,
  inputRef,
  onInput,
  onSubmit,
  onSkip,
  onNext,
  onBack,
  onToggleHint,
  onInsertSymbol,
}: PracticeViewProps) {
  const progress = progressPercent(index, total, !!judgement)
  const modeTag = mode === 'random' ? '随机' : mode === 'custom' ? '自定义' : '章节'

  return (
    <Page subtitle={modeLabel}>
      <section className="card practice-card">
        <div
          className="progress-bar"
          role="progressbar"
          aria-label="练习进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="question-info">
          <span className="question-counter">
            第 {index + 1} / {total} 题
          </span>
          <span className="tag">{modeTag}</span>
        </div>

        <div className="question-card">
          <h3 className="question-text">{question.description}</h3>
          {question.hint && (
            <div className="hint">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-expanded={showHint}
                aria-controls="hint-text"
                onClick={onToggleHint}
              >
                {showHint ? '收起提示' : '查看提示'}
              </button>
              {showHint && (
                <p id="hint-text" className="hint-text">
                  {question.hint}
                </p>
              )}
            </div>
          )}

          <div className="input-area">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => onInput(e.target.value)}
              readOnly={!!judgement}
              aria-label="化学方程式输入"
              aria-invalid={preview.error ? true : undefined}
              placeholder="请输入化学方程式... 例：Fe2O3 + 3CO =[高温] 2Fe + 3CO2↑"
              rows={3}
              spellCheck={false}
            />
            <ShortcutBar disabled={!!judgement} onInsert={onInsertSymbol} />
            <div className="hint hint-small">点击按钮或按 Ctrl+数字 快速插入符号，Enter 提交</div>
          </div>

          <div className="preview">
            {preview.error ? (
              <p className="preview-error">解析失败：{preview.error}</p>
            ) : preview.html ? (
              <Latex html={preview.html} className="preview-latex" />
            ) : (
              <p className="preview-placeholder">实时预览显示在这里</p>
            )}
          </div>

          <div className="button-group">
            {!judgement ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onSubmit}
                disabled={!input.trim() || !!preview.error}
              >
                提交答案
              </button>
            ) : (
              <button type="button" className="btn btn-success" onClick={onNext}>
                {index + 1 >= total ? '完成' : '下一题'}
              </button>
            )}
            {!judgement && (
              <button type="button" className="btn btn-danger" onClick={onSkip}>
                跳过
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              返回
            </button>
          </div>
        </div>
      </section>

      {judgement && (
        <section
          className={`answer-section ${judgement.correct ? 'answer-correct' : 'answer-wrong'}`}
          aria-live="polite"
        >
          <h4 className="answer-title">
            {judgement.correct ? '✓ 回答正确！' : '✗ 回答错误！'}
          </h4>

          <div className="equation-display correct-equation">
            <span className="eq-label">正确答案：</span>
            <Latex html={answerHtml} className="answer-latex" />
          </div>

          {judgement.messages.length > 0 && (
            <ul className="result-messages">
              {judgement.messages.map((message, i) => (
                <li key={i}>{message}</li>
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
    </Page>
  )
}
