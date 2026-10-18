import { useCallback, useEffect, useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { db } from '../data/db'
import { initApp, type InitResult } from './bootstrap'
import { routes } from './routes'
import { S } from '../strings.vi'
import { ErrorBoundary, ErrorScreen } from '../ui/ErrorScreen'
import { FeedbackProvider, useFeedback } from '../ui/feedback'

const router = createHashRouter(routes)

// UC_0901 — nạp dữ liệu trước khi vẽ SC_0001; lỗi → màn lỗi + Thử lại (C 6).
export function App() {
  const [init, setInit] = useState<InitResult | null>(null)
  const run = useCallback(() => {
    setInit(null)
    void initApp(db).then(setInit)
  }, [])
  useEffect(run, [run])

  if (!init) return null
  if (init.state === 'error') return <ErrorScreen message={S.initError} actionLabel={S.retry} onAction={run} />

  return (
    <ErrorBoundary>
      <FeedbackProvider>
        <ThemeSync />
        <UpdatePrompt />
        <RouterProvider router={router} />
      </FeedbackProvider>
    </ErrorBoundary>
  )
}

// UC_0402 — Giao diện Sáng / Tối / Theo hệ thống. "system" → bỏ data-theme để CSS theo prefers-color-scheme.
function ThemeSync() {
  const theme = useLiveQuery(async () => (await db.settings.get('main'))?.theme, [])
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
    else delete root.dataset.theme
  }, [theme])
  return null
}

// ADR_009 / D-4 — có bản mới thì hỏi, người dùng tự bấm Tải lại (không tự reload giữa lúc đang ghi shot).
function UpdatePrompt() {
  const { toast } = useFeedback()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  useEffect(() => {
    if (needRefresh) toast(S.newVersion, { action: { label: S.reload, fn: () => void updateServiceWorker(true) } })
  }, [needRefresh, toast, updateServiceWorker])
  return null
}
