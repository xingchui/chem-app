import { Page } from '../components/Page'
import { SelectList } from '../components/SelectList'
import { getSectionQuestions, getSections } from '../questions'

interface SectionSelectViewProps {
  book: string
  chapter: string
  onSelect: (section: string) => void
  onBack: () => void
}

export function SectionSelectView({ book, chapter, onSelect, onBack }: SectionSelectViewProps) {
  const items = getSections(book, chapter).map(section => ({
    key: section,
    title: section,
    meta: `${getSectionQuestions(book, chapter, section).length} 题`,
    onClick: () => onSelect(section),
  }))

  return (
    <Page subtitle={`${book} · ${chapter}`}>
      <section className="card">
        <h2 className="card-title">选择节</h2>
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
