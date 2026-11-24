import { useMemo } from 'react'
import { tryParseEquation } from './engine/parse'
import { eqToLatex } from './engine/latex'
import { renderLatex } from './renderLatex'

export interface PreviewState {
  html?: string
  error?: string
}

/** 输入 → 实时 LaTeX 预览（解析失败给出错误消息） */
export function usePreview(src: string): PreviewState {
  return useMemo(() => {
    if (!src.trim()) return {}
    const result = tryParseEquation(src)
    if (result.error) return { error: result.error }
    if (result.eq) return { html: renderLatex(eqToLatex(result.eq)) }
    return { error: '解析失败' }
  }, [src])
}
