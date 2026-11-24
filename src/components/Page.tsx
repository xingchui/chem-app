import type { ReactNode } from 'react'

interface PageProps {
  subtitle: ReactNode
  children: ReactNode
}

/** 统一页面骨架：标题栏 + 内容 */
export function Page({ subtitle, children }: PageProps) {
  return (
    <main className="app">
      <header className="app-header">
        <h1>化学方程式练习</h1>
        <p>{subtitle}</p>
      </header>
      {children}
    </main>
  )
}
