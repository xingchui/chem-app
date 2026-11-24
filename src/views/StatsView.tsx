import { Page } from '../components/Page'
import { accuracy, type Stats } from '../stats'

interface StatsViewProps {
  stats: Stats
  onClear: () => void
  onBack: () => void
}

export function StatsView({ stats, onClear, onBack }: StatsViewProps) {
  return (
    <Page subtitle="学习统计">
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
            <p>{accuracy(stats.correct, stats.total)}%</p>
          </div>
          <div className="stat-card">
            <h3>错题数</h3>
            <p>{stats.wrong}</p>
          </div>
        </div>
        <div className="button-group">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            返回
          </button>
          <button type="button" className="btn btn-danger" onClick={onClear}>
            清空统计
          </button>
        </div>
      </section>
    </Page>
  )
}
