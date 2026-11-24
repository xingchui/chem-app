import { Page } from '../components/Page'
import { SelectList } from '../components/SelectList'
import { QUESTIONS, getChapters, getSections } from '../questions'

interface ChapterSelectViewProps {
  book: string
  onSelect: (chapter: string) => void
  onBack: () => void
}

export function ChapterSelectView({ book, onSelect, onBack }: ChapterSelectViewProps) {
  const items = getChapters(book).map(chapter => ({
    key: chapter,
    title: chapter,
    meta: `${getSections(book, chapter).length} 节 · ${
      QUESTIONS.filter(q => q.book === book && q.chapter === chapter).length
    } 题`,
    onClick: () => onSelect(chapter),
  }))

  return (
    <Page subtitle={book}>
      <section className="card">
        <h2 className="card-title">选择章</h2>
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
