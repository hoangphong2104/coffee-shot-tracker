import { useRef } from 'react'
import type { Bean, Device } from '../data/types'
import { dayLabel, hm } from '../domain/format'
import { methodName } from '../domain/shot'
import { cardDrink, cardRecipe, rating, type ShotView } from '../domain/view'

// UC_0101 bước 4 — thẻ shot dùng chung SC_0001, SC_0101.
export function ShotRow({ v, bean, grinder, selected, onClick, onLongPress }: {
  v: ShotView
  bean?: Bean
  grinder?: Device
  selected?: boolean
  onClick: () => void
  onLongPress?: () => void
}) {
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)
  const r = rating(v)
  const drink = cardDrink(v)
  const clear = () => window.clearTimeout(timer.current)
  return (
    <button
      type="button"
      className={`shot ${selected ? 'sel' : ''}`}
      aria-pressed={selected === undefined ? undefined : selected}
      aria-label={`Shot ${hm(v.brewedAt)} ${bean?.name ?? ''}, rating ${r ?? 'chưa chấm'}`}
      onPointerDown={() => {
        if (!onLongPress) return
        longPressed.current = false
        // UC_0101 bước 7 — chạm giữ 0.55 giây
        timer.current = window.setTimeout(() => {
          longPressed.current = true
          onLongPress()
        }, 550)
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => onLongPress && e.preventDefault()}
      onClick={() => {
        if (longPressed.current) return void (longPressed.current = false)
        onClick()
      }}
    >
      <span className="t num">
        {hm(v.brewedAt)} · {dayLabel(v.brewedAt)}
        {v.method !== 'espresso' && <> · <span className="badge">{methodName(v)}</span></>}
        {drink && <> · <span className="badge">{drink}</span></>}
        {!v.cup && <> · <span className="badge custom">Chờ thưởng thức</span></>}
      </span>
      <span className="b">{bean?.name ?? '—'}</span>
      <span className="f">{cardRecipe(v, grinder) || '—'}</span>
      {r != null ? (
        <span className={`r rating ${r >= 8 ? 'hi' : ''}`}>
          {r}
          <span className="small">/10</span>
        </span>
      ) : (
        <span className="r small muted">—</span>
      )}
    </button>
  )
}
