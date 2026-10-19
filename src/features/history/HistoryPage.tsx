import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom'
import { useBeans, useCups, useDevices, useShotViews } from '../../data/hooks'
import type { Method } from '../../data/types'
import { dayLabel } from '../../domain/format'
import { methodLabel, METHODS } from '../../domain/shot'
import { applyFilter, drinkOptions, groupByDay, isFiltered, NO_FILTER, type HistoryFilter } from '../../domain/view'
import { EmptyState } from '../../ui/controls'
import { useHeaderAction } from '../../ui/Shell'
import { PickList, Sheet } from '../../ui/Sheet'
import { ShotRow } from '../../ui/ShotRow'
import { PAGE, setHistory, useHistoryState } from './filterStore'

// SC_0101 / UC_0101 + UC_0102 — lịch sử theo ngày, lọc, chọn 2 shot để so sánh.

type SheetKind = null | 'bean' | 'rating' | 'drink' | 'method'
const RATING_LABEL = (r: HistoryFilter['rating']) => (r === 'none' ? 'Chưa chấm' : r === 'waiting' ? 'Chờ thưởng thức' : `≥ ${r}`)

export function HistoryPage() {
  const views = useShotViews()
  const beans = useBeans()
  const devices = useDevices()
  const cups = useCups()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { filter, limit, scrollY } = useHistoryState()
  const navType = useNavigationType()
  const restored = useRef(false)
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [select, setSelect] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const sentinel = useRef<HTMLDivElement>(null)

  // UC_0102 bước 9 — mở từ "Xem shot" của một hạt
  useEffect(() => {
    const bean = sp.get('bean')
    if (!bean) return
    setHistory({ filter: { ...NO_FILTER, bean } })
    setSp({}, { replace: true })
  }, [sp, setSp])

  const action = useMemo(
    () => (
      <button className="link-btn" onClick={() => { setSelect((s) => !s); setPicked([]) }}>
        {select ? 'Huỷ chọn' : 'Chọn'}
      </button>
    ),
    [select],
  )
  useHeaderAction(views?.length ? action : null)

  const list = useMemo(() => (views ? applyFilter(views, filter) : []), [views, filter])
  const more = list.length > limit

  // UC_0101 bước 5 — cuộn gần cuối → thêm 30
  useEffect(() => {
    const el = sentinel.current
    if (!el || !more || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((es) => es[0].isIntersecting && setHistory({ limit: limit + PAGE }), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, limit])

  // UC_0101 bước 6 — quay lại (POP) cuộn về chỗ cũ sau khi danh sách đã đọc xong từ DB
  const ready = !!(views && beans && devices && cups)
  useLayoutEffect(() => {
    if (!ready || restored.current) return
    restored.current = true
    if (navType === 'POP' && scrollY) window.scrollTo(0, scrollY)
  }, [ready, navType, scrollY])

  if (!views || !beans || !devices || !cups) return null
  if (!views.length)
    return (
      <EmptyState title="Chưa có shot nào">
        <Link className="btn btn-primary" to="/shots/new">＋ Ghi shot</Link>
      </EmptyState>
    )

  const bean = (id: string) => beans.find((b) => b.id === id)
  const dev = (id: string | null) => devices.find((d) => d.id === id)
  const setFilter = (f: Partial<HistoryFilter>) => setHistory({ filter: { ...filter, ...f } })
  const clear = () => setHistory({ filter: NO_FILTER })
  const toggle = (id: string, start = false) => {
    const next = start ? [id] : picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]
    if (next.length === 2) {
      setSelect(false)
      setPicked([])
      navigate(`/compare?a=${next[0]}&b=${next[1]}`) // A = chọn trước, B = chọn sau
      return
    }
    setPicked(next)
  }

  const chip = (kind: Exclude<SheetKind, null>, label: string, active: boolean, value: string) => (
    <button className="chip" aria-pressed={active} onClick={() => setSheet(kind)}>{active ? `✓ ${value}` : label}</button>
  )

  return (
    <>
      <div className="chips" role="toolbar" aria-label="Bộ lọc">
        {chip('bean', 'Hạt', !!filter.bean, bean(filter.bean ?? '')?.name ?? '')}
        {chip('rating', 'Rating', !!filter.rating, RATING_LABEL(filter.rating))}
        {chip('drink', 'Kiểu uống', filter.drinks.length > 0, filter.drinks.join(', '))}
        {chip('method', 'Phương pháp', filter.methods.length > 0, filter.methods.map(methodLabel).join(', '))}
        {isFiltered(filter) && <button className="chip" onClick={clear}>Xoá lọc</button>}
      </div>
      <div className="small muted -mt-2" aria-live="polite">
        {list.length} shot{select ? ` · Đã chọn ${picked.length}/2 để so sánh` : ''}
      </div>

      {list.length === 0 ? (
        <EmptyState title="Không có shot khớp bộ lọc">
          <button className="btn btn-ghost" onClick={clear}>Xoá lọc</button>
        </EmptyState>
      ) : (
        groupByDay(list.slice(0, limit)).map((g) => (
          <section key={g.key} className="stack" style={{ gap: 0 }}>
            <h2 className="day-h">
              {dayLabel(g.at)}
              <span>{g.items.length} shot{g.avg ? ` · TB ${g.avg}` : ''}</span>
            </h2>
            {g.items.map((v) => (
              <ShotRow
                key={v.id}
                v={v}
                bean={bean(v.beanId)}
                grinder={dev(v.grinderId)}
                selected={select ? picked.includes(v.id) : undefined}
                onClick={() => {
                  if (select) return toggle(v.id)
                  setHistory({ scrollY: window.scrollY })
                  navigate(`/shots/${v.id}`)
                }}
                onLongPress={() => {
                  if (select) return
                  setSelect(true)
                  toggle(v.id, true)
                }}
              />
            ))}
          </section>
        ))
      )}
      {more && <div ref={sentinel} className="small muted py-3 text-center">Đang tải thêm…</div>}

      {sheet === 'bean' && (
        <PickList
          title="Lọc theo hạt"
          search="Tìm tên hạt, roaster"
          items={[
            { value: '', text: 'Tất cả hạt', on: !filter.bean },
            ...[...beans]
              .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name, 'vi') : a.status === 'active' ? -1 : 1))
              .map((b) => ({ value: b.id, text: b.name, sub: `${b.roaster ?? ''}${b.status === 'out' ? ' · Đã hết' : ''}`, on: filter.bean === b.id })),
          ]}
          onPick={(v) => { setFilter({ bean: v || null }); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'rating' && (
        <PickList
          title="Lọc theo rating"
          items={[
            { value: '', text: 'Tất cả', on: !filter.rating },
            ...[7, 8, 9].map((n) => ({ value: String(n), text: `≥ ${n}`, on: filter.rating === n })),
            { value: 'none', text: 'Chưa chấm', on: filter.rating === 'none' },
            { value: 'waiting', text: 'Chờ thưởng thức', on: filter.rating === 'waiting' },
          ]}
          onPick={(v) => {
            setFilter({ rating: v === '' ? null : v === 'none' || v === 'waiting' ? v : Number(v) })
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'drink' && (
        <MultiSheet
          title="Lọc theo kiểu uống"
          options={drinkOptions(cups).map((d) => ({ value: d, label: d }))}
          value={filter.drinks}
          onApply={(drinks) => { setFilter({ drinks }); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'method' && (
        <MultiSheet
          title="Lọc theo phương pháp"
          // C-2: thêm Khác để lọc được shot phương pháp Khác (UC_0102 bước 4)
          options={[...METHODS.map((m) => ({ value: m.id, label: m.label })), { value: 'other', label: 'Khác' }]}
          value={filter.methods}
          onApply={(methods) => { setFilter({ methods: methods as Method[] }); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

/** UC_0102 bước 3–4 — mỗi dòng một công tắc, nút Áp dụng. */
function MultiSheet({ title, options, value, onApply, onClose }: {
  title: string
  options: { value: string; label: string }[]
  value: string[]
  onApply: (v: string[]) => void
  onClose: () => void
}) {
  const [sel, setSel] = useState(value)
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="list">
        {options.map((o) => (
          <label key={o.value} className="li">
            <span className="main"><b>{o.label}</b></span>
            <input
              type="checkbox"
              className="switch"
              checked={sel.includes(o.value)}
              onChange={(e) => setSel(e.target.checked ? [...sel, o.value] : sel.filter((x) => x !== o.value))}
            />
          </label>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => onApply(sel)}>Áp dụng</button>
    </Sheet>
  )
}
