import { Component, type ReactNode } from 'react'
import { S } from '../strings.vi'

// UC_0901 C 6 (không mở được bộ nhớ) và NFR_011 (lỗi không bắt được). Không gửi lỗi đi đâu (SEC-001).
export function ErrorScreen({ message, actionLabel, onAction }: { message: string; actionLabel: string; onAction: () => void }) {
  return (
    <main className="mx-auto flex min-h-full max-w-app flex-col items-center justify-center gap-6 px-8 text-center">
      <svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
        <circle cx="24" cy="24" r="22" />
        <circle cx="24" cy="24" r="14" />
      </svg>
      <p role="alert" className="m-0">{message}</p>
      <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>
    </main>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return <ErrorScreen message={S.crashTitle} actionLabel={S.reload} onAction={() => location.reload()} />
    return this.props.children
  }
}
