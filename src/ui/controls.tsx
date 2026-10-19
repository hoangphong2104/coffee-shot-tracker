import { useId, useRef, type ReactNode } from 'react'
import { Chev, Warn } from './icons'

export const ErrMsg = ({ id, children }: { id?: string; children: ReactNode }) => (
  <div className="err-msg" id={id} role="alert">
    <Warn />
    <span>{children}</span>
  </div>
)

/** Nhóm chip một lựa chọn; chạm lại chip đang chọn = bỏ chọn khi `toggle`; giá trị tự gõ hiện như chip đang chọn. */
export function ChoiceChips({ options, value, onChange, onOther, toggle = false, wrap = true, label }: {
  options: readonly string[]
  value: string | null | undefined
  onChange: (v: string | null) => void
  onOther?: () => void
  toggle?: boolean
  wrap?: boolean
  label: string
}) {
  const custom = value && !options.includes(value) ? value : null
  return (
    <div className={wrap ? 'row-wrap' : 'chips'} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={value === o} onClick={() => onChange(toggle && value === o ? null : o)}>
          {o}
        </button>
      ))}
      {custom && (
        <button type="button" className="chip" aria-pressed="true" onClick={() => onChange(toggle ? null : custom)}>
          {custom}
        </button>
      )}
      {onOther && (
        <button type="button" className="chip" onClick={onOther}>Khác…</button>
      )}
    </div>
  )
}

/** UC_0114 bước 7 — 10 nút 1–10; chạm lại số đang chọn = bỏ chọn. */
export function ScaleButtons({ label, value, onChange, small }: { label: string; value?: number | null; onChange: (v: number | null) => void; small?: boolean }) {
  return (
    <div className={`scale ${small ? 'sm' : ''}`} role="group" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-pressed={value === n} aria-label={`${label} ${n}`} onClick={() => onChange(value === n ? null : n)}>
          {n}
        </button>
      ))}
    </div>
  )
}

/** Dòng số nhỏ (vùng mở rộng) — ô số bên phải. */
export function NumberRow({ label, hint, value, prefill, error, onChange, onBlur, fieldId }: {
  label: string
  hint?: string
  value: string
  prefill?: boolean
  error?: ReactNode
  onChange: (v: string) => void
  onBlur?: () => void
  fieldId: string
}) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="nrow">
        <label htmlFor={fieldId}>
          <b>{label}</b>
          {hint && <div className="hint num">{hint}</div>}
        </label>
        <input
          id={fieldId}
          className={`input ${prefill ? 'prefill' : ''} ${error ? 'err' : ''}`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder="—"
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </div>
      {error && <ErrMsg>{error}</ErrMsg>}
    </div>
  )
}

/** Nhóm thu gọn (details) với dòng tóm tắt giá trị đã nhập. */
export function Group({ title, summary, defaultOpen, children }: { title: string; summary?: string; defaultOpen?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  return (
    <details className="grp" ref={ref} open={defaultOpen}>
      <summary>
        <span>
          {title}
          {summary && <div className="sumv">{summary}</div>}
        </span>
        <Chev />
      </summary>
      <div className="body">{children}</div>
    </details>
  )
}

export function TextField({ label, value, onChange, error, required, multiline, placeholder, list, type = 'text', max }: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  required?: boolean
  multiline?: boolean
  placeholder?: string
  list?: string[]
  type?: 'text' | 'date'
  max?: string
}) {
  const id = useId()
  const cls = `input ${error ? 'err' : ''}`
  return (
    <>
      <label className="f">
        <span>
          {label} {required && <span className="req" aria-hidden="true">*</span>}
        </span>
        {multiline ? (
          <textarea className={cls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input className={cls} type={type} max={max} value={value} placeholder={placeholder} list={list?.length ? id : undefined} autoComplete="off" aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
        )}
      </label>
      {list && list.length > 0 && (
        <datalist id={id}>
          {list.map((v) => <option key={v} value={v} />)}
        </datalist>
      )}
      {error && <ErrMsg>{error}</ErrMsg>}
    </>
  )
}

export const SaveBar = ({ children }: { children: ReactNode }) => <div className="savebar">{children}</div>

export function EmptyState({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {sub && <span>{sub}</span>}
      {children}
    </div>
  )
}
