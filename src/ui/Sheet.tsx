import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fold } from '../domain/format'
import { Check, Search } from './icons'

// Sheet đáy màn: chạm ra ngoài hoặc Esc = đóng, không lưu (UC_0202 bước 7; platform-ui §4 bàn phím).
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export interface PickItem { value: string; text: string; sub?: string; on?: boolean }

/** Danh sách chọn trong sheet, có ô tìm tuỳ chọn (so khớp không dấu). */
export function PickList({ title, items, onPick, onClose, search, footer }: {
  title: string
  items: PickItem[]
  onPick: (v: string) => void
  onClose: () => void
  search?: string
  footer?: ReactNode
}) {
  const [q, setQ] = useState('')
  const list = q ? items.filter((it) => fold(it.text).includes(fold(q))) : items
  return (
    <Sheet title={title} onClose={onClose}>
      {search && (
        <label className="input flex items-center gap-2">
          <Search />
          <input className="min-h-10 flex-1 border-0 bg-transparent outline-none" placeholder={search} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>
      )}
      <div className="list">
        {list.length ? (
          list.map((it) => (
            <button key={it.value} className="li" onClick={() => onPick(it.value)}>
              <span className="main">
                <b>{it.text}</b>
                {it.sub && <div className="s">{it.sub}</div>}
              </span>
              {it.on && <Check />}
            </button>
          ))
        ) : (
          <div className="li muted">Không thấy kết quả</div>
        )}
      </div>
      {footer}
    </Sheet>
  )
}

/** "Khác…" — ô gõ + gợi ý giá trị đã dùng, nút Xong (UC_0114 bước 6, UC_0202 bước 2). */
export function AskOther({ title, suggestions, initial = '', onDone, onClose }: {
  title: string
  suggestions: string[]
  initial?: string
  onDone: (v: string) => void
  onClose: () => void
}) {
  const [v, setV] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const done = (x: string) => {
    onClose()
    if (x.trim()) onDone(x.trim())
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <input ref={ref} className="input" value={v} placeholder="Gõ giá trị" autoComplete="off" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && done(v)} />
      {suggestions.length > 0 && (
        <>
          <div className="small muted">Đã dùng trước</div>
          <div className="row-wrap">
            {suggestions.map((s) => (
              <button key={s} className="chip" onClick={() => done(s)}>{s}</button>
            ))}
          </div>
        </>
      )}
      <button className="btn btn-primary btn-block" onClick={() => done(v)}>Xong</button>
    </Sheet>
  )
}
