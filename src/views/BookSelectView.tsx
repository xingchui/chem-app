import { Page } from '../components/Page'
import { SelectList } from '../components/SelectList'
import { QUESTIONS, getBooks, getChapters } from '../questions'

interface BookSelectViewProps {
  onSelect: (book: string) => void
  onBack: () => void
}

export function BookSelectView({ onSelect, onBack }: BookSelectViewProps) {
  const items = getBooks().map(book => ({
    key: book,
    title: book,
    meta: `${getChapters(book).length} 章 · ${QUESTIONS.filter(q => q.book === book).length} 题`,
    onClick: () => onSelect(book),
  }))

  return (
    <Page subtitle="选择教材">
      <section className="card">
        <h2 className="card-title">选择教材</h2>
        <SelectList items={items} />
        <div className="button-group">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            返回
          </button>
        </div>
      </section>
    </Page>
  )
}
