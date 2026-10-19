import { useRef, type ReactNode } from 'react'
import { stepValue, wheelSides } from '../domain/shot'
import { ErrMsg } from './controls'

// SC_0102 v2.0 / UC_0103 bước 10 — hàng chỉnh số: chạm số hai bên = ± 1 bước,
// vuốt ngang mỗi 28 px = 1 bước (sang trái = tăng), chạm số giữa = gõ.

const SWIPE_PX = 28

export function WheelRow({ fieldId, label, value, step, prefill, error, onChange, onBlur }: {
  fieldId: string
  label: string
  value: string
  step: number
  prefill: boolean
  error?: ReactNode
  onChange: (v: string) => void
  onBlur: () => void
}) {
  const drag = useRef<{ x: number; steps: number; moved: boolean } | null>(null)
  const swallowClick = useRef(0)
  const latest = useRef(value)
  latest.current = value
  const [lo, hi] = wheelSides(value, step)

  const bump = (dir: 1 | -1, times = 1) => {
    let v = latest.current
    for (let i = 0; i < times; i++) v = stepValue(v, step, dir)
    latest.current = v
    onChange(v)
  }

  return (
    <div className={`wheel ${error ? 'err' : ''}`}>
      <label className="wl" htmlFor={fieldId}>{label}</label>
      <div
        className="wrow"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, steps: 0, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const n = Math.trunc((e.clientX - d.x) / SWIPE_PX)
          if (n !== d.steps) {
            const dir = n < d.steps ? 1 : -1 // sang trái = tăng
            bump(dir, Math.abs(n - d.steps))
            d.steps = n
            if (!d.moved) {
              d.moved = true
              ;(document.activeElement as HTMLElement | null)?.blur()
            }
          }
        }}
        onPointerUp={() => {
          if (drag.current?.moved) swallowClick.current = Date.now() + 350 // vuốt xong → chặn click 350 ms
          drag.current = null
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        <button type="button" className="wside" aria-label={`Giảm ${label}`} onClick={() => Date.now() > swallowClick.current && bump(-1)}>
          {lo}
        </button>
        <input
          id={fieldId}
          className={`wval ${prefill ? 'prefill' : ''}`}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          value={value}
          placeholder="—"
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        <button type="button" className="wside" aria-label={`Tăng ${label}`} onClick={() => Date.now() > swallowClick.current && bump(1)}>
          {hi}
        </button>
      </div>
      {error && <ErrMsg>{error}</ErrMsg>}
    </div>
  )
}
