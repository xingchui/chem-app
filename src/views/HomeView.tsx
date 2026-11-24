import { Page } from '../components/Page'

interface HomeViewProps {
  onChapter: () => void
  onRandom: () => void
  onStats: () => void
  onCustomBank: () => void
  onCustomPractice: () => void
}

export function HomeView({
  onChapter,
  onRandom,
  onStats,
  onCustomBank,
  onCustomPractice,
}: HomeViewProps) {
  return (
    <Page subtitle="选择练习模式，开始书写化学方程式">
      <section className="card">
        <h2 className="card-title">选择练习模式</h2>
        <div className="mode-grid">
          <button type="button" className="mode-card" onClick={onChapter}>
            <div className="mode-icon">📚</div>
            <h3>章节练习</h3>
            <p>按教材章节选择题目练习</p>
          </button>
          <button type="button" className="mode-card" onClick={onRandom}>
            <div className="mode-icon">🎲</div>
            <h3>随机练习</h3>
            <p>随机抽取方程式挑战</p>
          </button>
          <button type="button" className="mode-card" onClick={onStats}>
            <div className="mode-icon">📊</div>
            <h3>学习统计</h3>
            <p>查看学习进度和正确率</p>
          </button>
          <button type="button" className="mode-card" onClick={onCustomBank}>
            <div className="mode-icon">✏️</div>
            <h3>自定义题库</h3>
            <p>导入方程式，自定义练习</p>
          </button>
          <button type="button" className="mode-card" onClick={onCustomPractice}>
            <div className="mode-icon">🎯</div>
            <h3>自定义练习</h3>
            <p>练习自定义题库中的方程式</p>
          </button>
        </div>
      </section>
    </Page>
  )
}
