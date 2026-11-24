import 'katex/dist/katex.min.css'

interface LatexProps {
  html: string
  className?: string
}

/** 渲染已经生成的 KaTeX HTML；空字符串不占位 */
export function Latex({ html, className }: LatexProps) {
  if (!html) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
