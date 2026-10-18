import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

// FE_MOD_001 — Toast (role=status, 2.6 s; 6 s khi có nút hành động) và ConfirmDialog dạng promise
// (focus mặc định nút an toàn — UC_0108 bước 1).

type ToastAction = { label: string; fn: () => void }
type ToastState = { id: number; message: string; tone: 'info' | 'error'; action?: ToastAction } | null
type ConfirmOptions = { title: string; body?: string; ok: string; cancel?: string; danger?: boolean }

interface Feedback {
  toast: (message: string, opts?: { tone?: 'info' | 'error'; action?: ToastAction }) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const Ctx = createContext<Feedback | null>(null)

export function useFeedback(): Feedback {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFeedback ngoài FeedbackProvider')
  return v
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null)
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const showToast = useCallback<Feedback['toast']>((message, opts) => {
    window.clearTimeout(timer.current)
    const id = Date.now()
    setToast({ id, message, tone: opts?.tone ?? 'info', action: opts?.action })
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), opts?.action ? 6000 : 2600)
  }, [])

  const confirm = useCallback<Feedback['confirm']>(
    (opts) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  )

  const close = (v: boolean) => {
    dialog?.resolve(v)
    setDialog(null)
  }

  return (
    <Ctx.Provider value={{ toast: showToast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
        {toast && (
          <div role="status" className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-fg px-[18px] py-2.5 text-sm text-bg">
            <span>{toast.message}</span>
            {toast.action && (
              <button
                className="min-h-9 whitespace-nowrap rounded-full border border-bg px-3"
                onClick={() => {
                  setToast(null)
                  toast.action!.fn()
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
      {dialog && <ConfirmDialog {...dialog} onClose={close} />}
    </Ctx.Provider>
  )
}

function ConfirmDialog({ title, body, ok, cancel = 'Huỷ', danger, onClose }: ConfirmOptions & { onClose: (v: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => cancelRef.current?.focus(), [])
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="cd-title" className="flex w-full max-w-[380px] flex-col gap-4 rounded-[20px] bg-bg px-5 pb-5 pt-6 text-center">
        <h2 id="cd-title" className="caps m-0">{title}</h2>
        {body && <p className="m-0 text-muted">{body}</p>}
        <div className="grid grid-cols-2 gap-2.5">
          <button ref={cancelRef} className="btn btn-ghost" onClick={() => onClose(false)}>{cancel}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onClose(true)}>{ok}</button>
        </div>
      </div>
    </div>
  )
}
