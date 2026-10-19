import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'
import { useBeans, useCups, useDevices, useSettings, useShotViews } from '../../data/hooks'
import type { Method } from '../../data/types'
import { bestShot, dataset, defaultFilter, grindDomain, grindPoints, grinderChoice, niceTicks, pointShots, ratioPoints, tickDecimals, type AnalyticsFilter, type GrindPoint, type RatioPoint } from '../../domain/analytics'
import { dd, fmt, hm } from '../../domain/format'
import { fmtRatio, methodLabel, METHODS } from '../../domain/shot'
import { drinkOptions, rating } from '../../domain/view'
import { EmptyState } from '../../ui/controls'
import { PickList } from '../../ui/Sheet'
import { ShotRow } from '../../ui/ShotRow'

// SC_0106 / FE_MOD_007 — UC_0110 + UC_0111. Tải lười (ADR_005). Lọc giữ trong phiên (UC_0110 bước 2).

interface UiState { filter: AnalyticsFilter | null; grinder: string | null; table: boolean }
let ui: UiState = { filter: null, grinder: null, table: false }
const subs = new Set<() => void>()
const setUi = (p: Partial<UiState>) => {
  ui = { ...ui, ...p }
  subs.forEach((f) => f())
}
const useUi = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => ui)

const AXIS = { stroke: 'var(--muted)', tick: { fill: 'var(--muted)', fontSize: 11 }, tickLine: false }

export default function AnalyticsPage() {
  const views = useShotViews()
  const beans = useBeans()
  const devices = useDevices()
  const settings = useSettings()
  const cups = useCups()
  const navigate = useNavigate()
  const st = useUi()
  const [sheet, setSheet] = useState<null | 'bean' | 'method' | 'drink' | 'days'>(null)
  const [sel1, setSel1] = useState<GrindPoint | null>(null)
  const [sel2, setSel2] = useState<string | null>(null)
  const filter = useMemo(() => st.filter ?? defaultFilter(settings?.defaultMethod ?? 'espresso'), [st.filter, settings?.defaultMethod])
  const ds = useMemo(() => (views ? dataset(views, filter, Date.now()) : []), [views, filter])

  if (!views || !beans || !devices || !settings || !cups) return null
  if (!views.length)
    return (
      <EmptyState title="Chưa có dữ liệu" sub="Ghi vài shot để xem xu hướng">
        <Link className="btn btn-primary" to="/shots/new">＋ Ghi shot</Link>
      </EmptyState>
    )

  // Đổi lọc → bỏ điểm đang chọn ở cả hai biểu đồ
  const setFilter = (p: Partial<AnalyticsFilter>) => {
    setUi({ filter: { ...filter, ...p } })
    setSel1(null)
    setSel2(null)
    setSheet(null)
  }
  const beanName = (id: string) => beans.find((b) => b.id === id)?.name ?? '—'
  const dev = (id: string | null) => devices.find((d) => d.id === id)
  const view = (id: string) => views.find((v) => v.id === id)

  const { best, summary } = bestShot(ds)
  const g = grinderChoice(ds, st.grinder, settings.current.grinder)
  const points = grindPoints(ds, g.selected)
  const shotCount = pointShots(points)
  const domain = points.length ? grindDomain(points, dev(g.selected)) : [0, 10]
  const line = ratioPoints(ds)
  const yTicks = line.length ? niceTicks(Math.min(...line.map((p) => p.ratio)), Math.max(...line.map((p) => p.ratio)), 4) : []
  const yDp = tickDecimals(yTicks)
  const xTicks = line.length ? [line[0].at, (line[0].at + line[line.length - 1].at) / 2, line[line.length - 1].at] : []

  const info1 = sel1 && view(sel1.ids[0])
  const info2 = sel2 ? view(sel2) : undefined

  return (
    <>
      <div className="chips" role="toolbar" aria-label="Bộ lọc">
        <button className="chip" aria-pressed={!!filter.bean} onClick={() => setSheet('bean')}>{filter.bean ? `✓ ${beanName(filter.bean)}` : 'Tất cả hạt'}</button>
        <button className="chip" aria-pressed="true" onClick={() => setSheet('method')}>{methodLabel(filter.method)}</button>
        <button className="chip" aria-pressed={!!filter.drink} onClick={() => setSheet('drink')}>{filter.drink ? `✓ ${filter.drink}` : 'Mọi kiểu uống'}</button>
        <button className="chip" aria-pressed="true" onClick={() => setSheet('days')}>{filter.days ? `${filter.days} ngày` : 'Tất cả'}</button>
      </div>

      {/* UC_0110 bước 4 */}
      {best ? (
        <div className="card stack" style={{ gap: 6 }}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b className="flex-1 whitespace-nowrap font-normal">Shot tốt nhất</b>
            <span className="small muted">{summary}</span>
          </div>
          <ShotRow v={best} bean={beans.find((b) => b.id === best.beanId)} grinder={dev(best.grinderId)} onClick={() => navigate(`/shots/${best.id}`)} />
        </div>
      ) : (
        <div className="card muted">Chưa có shot nào được chấm trong phạm vi lọc</div>
      )}

      {/* UC_0110 bước 5–9 */}
      <section className="card stack">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 flex-1 text-base font-normal">Grind theo rating</h2>
          <span className="small muted">{shotCount} shot</span>
        </div>
        {g.ids.length > 0 && (
          <div className="chips" role="group" aria-label="Máy xay">
            {g.ids.map((id) => (
              <button key={id} className="chip" aria-pressed={g.selected === id} onClick={() => { setUi({ grinder: id }); setSel1(null) }}>
                {dev(id) ? `${dev(id)!.brand} ${dev(id)!.name}` : '—'}
              </button>
            ))}
          </div>
        )}
        {shotCount < 2 ? (
          <div className="small muted">Cần ít nhất 2 shot có grind và rating để vẽ biểu đồ</div>
        ) : st.table ? (
          <Table head={['Ngày', 'Grind', 'Rating']} rows={points.flatMap((p) => p.ids.map((id) => [dd(view(id)!.brewedAt), fmt(p.grind), String(p.rating)]))} />
        ) : (
          <>
            <div role="img" aria-label={`Biểu đồ grind theo rating, ${shotCount} shot`}>
              <ResponsiveContainer width="100%" height={236}>
                <ScatterChart margin={{ top: 12, right: 12, bottom: 18, left: -12 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis type="number" dataKey="grind" domain={domain} {...AXIS} label={{ value: 'Grind', position: 'insideBottom', offset: -10, fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis type="number" dataKey="rating" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} {...AXIS} />
                  <Scatter
                    data={points}
                    isAnimationActive={false}
                    shape={(props: unknown) => <GrindDot {...(props as DotProps<GrindPoint>)} selected={sel1} onPick={setSel1} />}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <Info>
              {info1 ? (
                <>
                  <span className="num">
                    {dd(info1.brewedAt)} · {beanName(info1.beanId)} · grind {fmt(sel1!.grind)} · rating {sel1!.rating}
                    {sel1!.count > 1 ? ` · ${sel1!.count} shot trùng` : ''}
                  </span>
                  <Link className="link-btn" to={`/shots/${info1.id}`}>Mở shot</Link>
                </>
              ) : (
                <span className="muted">Chạm vào một điểm để xem shot</span>
              )}
            </Info>
          </>
        )}
        <div className="hint">Mỗi chấm là một shot. Vùng grind có nhiều chấm cao là vùng ngon với hạt này. Chỉ vẽ cho một máy xay vì mỗi máy có thang grind riêng.</div>
      </section>

      {/* UC_0111 */}
      <section className="card stack">
        <div className="flex items-baseline gap-2">
          <h2 className="m-0 flex-1 text-base font-normal">Ratio theo thời gian</h2>
          <span className="small muted">{line.length} shot</span>
        </div>
        {line.length < 2 ? (
          <div className="small muted">Cần ít nhất 2 shot có dose và yield để vẽ biểu đồ</div>
        ) : st.table ? (
          <Table head={['Ngày', 'Ratio', 'Rating']} rows={line.map((p) => { const v = view(p.id)!; return [`${dd(p.at)} ${hm(p.at)}`, fmtRatio(p.ratio), String(rating(v) ?? '—')] })} />
        ) : (
          <>
            <div role="img" aria-label={`Biểu đồ ratio theo thời gian, ${line.length} shot`}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={line} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis type="number" dataKey="at" domain={['dataMin', 'dataMax']} ticks={xTicks} interval={0} tickFormatter={(t: number) => dd(t)} {...AXIS} />
                  <YAxis dataKey="ratio" domain={[yTicks[0], yTicks[yTicks.length - 1]]} ticks={yTicks} tickFormatter={(r: number) => `1:${r.toFixed(yDp)}`} width={56} {...AXIS} />
                  <Line
                    dataKey="ratio"
                    stroke="var(--fg)"
                    strokeWidth={1.2}
                    isAnimationActive={false}
                    activeDot={false}
                    dot={(props: unknown) => <RatioDot key={(props as DotProps<RatioPoint>).payload.id} {...(props as DotProps<RatioPoint>)} selected={sel2} onPick={setSel2} />}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Info>
              {info2 ? (
                <>
                  <span className="num">{dd(info2.brewedAt)} · {beanName(info2.beanId)} · {fmtRatio(line.find((p) => p.id === sel2)!.ratio)} · rating {rating(info2) ?? '—'}</span>
                  <Link className="link-btn" to={`/shots/${info2.id}`}>Mở shot</Link>
                </>
              ) : (
                <span className="muted">Chạm vào một điểm để xem shot</span>
              )}
            </Info>
          </>
        )}
      </section>

      <div className="flex gap-2.5">
        <button className="btn btn-ghost flex-1" onClick={() => setUi({ table: !st.table })}>{st.table ? 'Xem dạng biểu đồ' : 'Xem dạng bảng'}</button>
        <Link className="btn btn-ghost flex-1" to="/compare">So sánh 2 shot</Link>
      </div>

      {sheet === 'bean' && (
        <PickList
          title="Hạt"
          items={[{ value: '', text: 'Tất cả hạt', on: !filter.bean }, ...beans.map((b) => ({ value: b.id, text: b.name, sub: b.roaster, on: filter.bean === b.id }))]}
          onPick={(v) => setFilter({ bean: v || null })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'method' && (
        <PickList
          title="Phương pháp"
          items={[...METHODS.map((m) => ({ value: m.id as string, text: m.label })), { value: 'other', text: 'Khác (tự gõ)' }].map((m) => ({ ...m, on: filter.method === m.value }))}
          onPick={(v) => setFilter({ method: v as Method })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'drink' && (
        <PickList
          title="Kiểu uống"
          items={[{ value: '', text: 'Mọi kiểu uống', on: !filter.drink }, ...drinkOptions(cups).map((d) => ({ value: d, text: d, on: filter.drink === d }))]}
          onPick={(v) => setFilter({ drink: v || null })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'days' && (
        <PickList
          title="Khoảng thời gian"
          items={([30, 90, 0] as const).map((d) => ({ value: String(d), text: d ? `${d} ngày` : 'Tất cả', on: filter.days === d }))}
          onPick={(v) => setFilter({ days: Number(v) as AnalyticsFilter['days'] })}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

interface DotProps<T> { cx?: number; cy?: number; payload: T }

/** Chấm grind: gộp điểm trùng thành chấm to hơn + số đếm; vùng chạm r = 15 (≥ 24 pt — UC_0110 bước 7). */
function GrindDot({ cx = 0, cy = 0, payload: p, selected, onPick }: DotProps<GrindPoint> & { selected: GrindPoint | null; onPick: (p: GrindPoint) => void }) {
  const on = selected?.grind === p.grind && selected?.rating === p.rating
  const r = Math.min(6 + (p.count - 1) * 2, 11) + (on ? 2 : 0)
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={on ? 'var(--bg)' : 'var(--fg)'} stroke={on ? 'var(--fg)' : 'var(--bg)'} strokeWidth={2} />
      {p.count > 1 && (
        <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill={on ? 'var(--fg)' : 'var(--bg)'} style={{ pointerEvents: 'none' }}>{p.count}</text>
      )}
      <circle cx={cx} cy={cy} r={15} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onPick(p)}>
        <title>grind {p.grind}, rating {p.rating}: {p.count} shot</title>
      </circle>
    </g>
  )
}

function RatioDot({ cx = 0, cy = 0, payload: p, selected, onPick }: DotProps<RatioPoint> & { selected: string | null; onPick: (id: string) => void }) {
  const on = selected === p.id
  return (
    <g>
      <circle cx={cx} cy={cy} r={on ? 7 : 5} fill={on ? 'var(--bg)' : 'var(--fg)'} stroke={on ? 'var(--fg)' : 'var(--bg)'} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={13} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onPick(p.id)} />
    </g>
  )
}

const Info = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-11 items-center justify-between gap-2 text-sm" aria-live="polite">{children}</div>
)

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
