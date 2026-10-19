import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBeans, useDevices, useShotViews } from '../../data/hooks'
import { dd, hm } from '../../domain/format'
import { methodName, recipe } from '../../domain/shot'
import { drinkName } from '../../domain/cup'
import { compareRows, compareTastes, grinderBanner, rating, type ShotView } from '../../domain/view'
import { EmptyState } from '../../ui/controls'
import { Warn } from '../../ui/icons'
import { PickList } from '../../ui/Sheet'

// SC_0105 / UC_0109 — so sánh 2 shot. Đường áp suất chồng (bước 8) nối ở CODE-007.

export function ComparePage() {
  const views = useShotViews()
  const beans = useBeans()
  const devices = useDevices()
  const [sp, setSp] = useSearchParams()
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [picking, setPicking] = useState<null | 'a' | 'b'>(null)
  if (!views || !beans || !devices) return null
  if (views.length < 2) return <EmptyState title="Cần ít nhất 2 shot để so sánh" />

  // Bước 9 — shot đã bị xoá → ô về "Chọn shot"
  const find = (id: string | null) => (id ? views.find((v) => v.id === id) : undefined)
  const A = find(sp.get('a'))
  const B = find(sp.get('b'))
  const set = (a?: string, b?: string) => setSp(Object.fromEntries(Object.entries({ a, b }).filter(([, v]) => v)) as Record<string, string>, { replace: true })
  const beanName = (v: ShotView) => beans.find((b) => b.id === v.beanId)?.name ?? '—'

  const pickBox = (side: 'a' | 'b', v?: ShotView) => (
    <button type="button" className="card min-w-0 border-0 bg-transparent text-left" style={{ borderTop: '1px solid var(--line)' }} onClick={() => setPicking(side)}>
      <div className="small muted">Shot {side.toUpperCase()}</div>
      {v ? (
        <>
          <b className="num font-normal">{dd(v.brewedAt)} {hm(v.brewedAt)}</b>
          <div className="small truncate">{beanName(v)}</div>
        </>
      ) : (
        <b className="font-normal">Chọn shot</b>
      )}
    </button>
  )

  const header = (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      {pickBox('a', A)}
      <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-lg" aria-label="Đổi chỗ A và B" onClick={() => set(B?.id, A?.id)}>⇄</button>
      {pickBox('b', B)}
    </div>
  )

  const sheet = picking && (
    <PickList
      title={`Chọn shot ${picking.toUpperCase()}`}
      search="Tìm theo tên hạt"
      items={views.map((v) => {
        const r = rating(v)
        return {
          value: v.id,
          text: `${dd(v.brewedAt)} ${hm(v.brewedAt)} · ${beanName(v)}${v.cup ? '' : ' · Chờ thưởng thức'}`,
          sub: `${methodName(v)} · ${v.cup ? drinkName(v.cup) : '—'} · ${recipe(v)}${r != null ? ` · ${r}/10` : ''}`,
          on: v.id === (picking === 'a' ? A?.id : B?.id),
          disabled: v.id === (picking === 'a' ? B?.id : A?.id), // không chọn trùng (bước 2)
          search: beanName(v),
        }
      })}
      onPick={(id) => {
        if (picking === 'a') set(id, B?.id)
        else set(A?.id, id)
        setPicking(null)
      }}
      onClose={() => setPicking(null)}
    />
  )

  if (!A || !B)
    return (
      <>
        {header}
        <div className="empty">{!A && !B ? 'Chọn 2 shot để so sánh' : 'Chọn shot thứ hai để so sánh'}</div>
        {sheet}
      </>
    )

  const banner = grinderBanner(A, B, devices)
  const rows = compareRows(A, B, beans, devices).filter((r) => !onlyDiff || r.diff)
  const tastes = compareTastes(A, B)

  return (
    <>
      {header}
      {banner && (
        <div className="banner" role="status">
          <Warn />
          <span>{banner}</span>
        </div>
      )}
      <label className="flex items-center justify-between">
        <span>Chỉ hiện khác biệt</span>
        <input type="checkbox" className="switch" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
      </label>
      <div className="card overflow-x-auto" style={{ padding: '4px 0' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Thông số</th>
              <th scope="col"><Link className="link-btn" style={{ padding: 0, minHeight: 0 }} to={`/shots/${A.id}`}>Shot A</Link></th>
              <th scope="col"><Link className="link-btn" style={{ padding: 0, minHeight: 0 }} to={`/shots/${B.id}`}>Shot B</Link></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.diff ? 'diff' : ''}>
                <td>{r.diff ? '≠ ' : ''}{r.label}</td>
                <td className="num">{r.a}</td>
                <td className="num">
                  {r.b}
                  {r.delta && <div className="delta">{r.delta}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small muted">Chênh lệch tính B − A</div>

      {tastes.length > 0 && (
        <div className="card stack">
          {tastes.map((t) => (
            <div key={t.label} className="stack" style={{ gap: 4 }}>
              <b className="small">{t.label}</b>
              {(['a', 'b'] as const).map((side) => (
                <div key={side} className="flex items-center gap-2 small" role="img" aria-label={`${side.toUpperCase()}: ${t.label} ${t[side] ?? 'trống'}`}>
                  <span className="w-4" aria-hidden="true">{side.toUpperCase()}</span>
                  <div className={`bar flex-1 ${side === 'b' ? 'b' : ''}`} aria-hidden="true"><i style={{ width: `${(t[side] ?? 0) * 10}%` }} /></div>
                  <b className="num w-6 text-right font-normal" aria-hidden="true">{t[side] ?? '—'}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {(A.cup?.tasteNotes || B.cup?.tasteNotes) && (
        <div className="card stack small">
          {A.cup?.tasteNotes && <div><b className="font-normal">A:</b> {A.cup.tasteNotes}</div>}
          {B.cup?.tasteNotes && <div><b className="font-normal">B:</b> {B.cup.tasteNotes}</div>}
        </div>
      )}
      {sheet}
    </>
  )
}
