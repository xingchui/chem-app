import katex from 'katex'

/** LaTeX 字符串 → KaTeX HTML（集中处理渲染与错误降级） */
export function renderLatex(latex: string): string {
  return katex.renderToString(latex, { throwOnError: false, displayMode: true })
}
