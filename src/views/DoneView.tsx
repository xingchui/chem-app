import { Page } from '../components/Page'
import { accuracy } from '../stats'

interface DoneViewProps {
  modeLabel: string
  correctCount: number
  total: number
  onRestart: () => void
  onHome: () => void
}

export function DoneView({ modeLabel, correctCount, total, onRestart, onHome }: DoneViewProps) {
  return (
    <Page subtitle={modeLabel}>
      <section className="card done-card">
        <h2 className="card-title">练习完成</h2>
        <p className="done-score">
          答对 <strong>{correctCount}</strong> / {total} 题
        </p>
        <p className="done-ratio">
          本轮正确率 <strong>{accuracy(correctCount, total)}%</strong>
        </p>
        <div className="button-group button-group-center">
          <button type="button" className="btn btn-primary" onClick={onRestart}>
            再来一轮
          </button>
          <button type="button" className="btn btn-secondary" onClick={onHome}>
            返回首页
          </button>
        </div>
      </section>
    </Page>
  )
}
