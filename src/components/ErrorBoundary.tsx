import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** 兜底渲染错误，避免整个应用白屏 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('应用渲染失败', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="app">
          <section className="card">
            <h2 className="card-title">页面出错了</h2>
            <p className="hint-small">{this.state.error.message}</p>
            <div className="button-group">
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                重新加载
              </button>
            </div>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
