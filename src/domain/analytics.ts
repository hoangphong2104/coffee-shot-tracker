import type { Device, Method } from '../data/types'
import { ratio } from './shot'
import { rating, type ShotView } from './view'

// FE_MOD_007 — UC_0110 (shot tốt nhất, grind theo rating) và UC_0111 (ratio theo thời gian).

const DAY = 86_400_000

export interface AnalyticsFilter { bean: string | null; method: Method; drink: string | null; days: 30 | 90 | 0 }
export const defaultFilter = (method: Method): AnalyticsFilter => ({ bean: null, method, drink: null, days: 90 })

/** UC_0110 bước 2–3 — <DS>. Kiểu uống: chỉ giữ shot có ly kiểu đó. */
export function dataset(vs: ShotView[], f: AnalyticsFilter, now: number): ShotView[] {
  return vs.filter(
    (v) =>
      v.method === f.method &&
      (!f.bean || v.beanId === f.bean) &&
      (!f.drink || v.cup?.drink === f.drink) &&
      (!f.days || v.brewedAt >= now - f.days * DAY),
  )
}

/** UC_0110 bước 4. */
export function bestShot(ds: ShotView[]) {
  const done = ds.filter((v) => v.cup)
  const rated = done.filter((v) => rating(v) != null)
  const best = [...rated].sort((a, b) => rating(b)! - rating(a)! || b.brewedAt - a.brewedAt)[0]
  const avg = rated.length ? (rated.reduce((s, v) => s + rating(v)!, 0) / rated.length).toFixed(1) : '—'
  const waiting = ds.length - done.length
  return { best, summary: `${done.length} shot · TB ${avg}${waiting ? ` · ${waiting} chờ thưởng thức` : ''}` }
}

/** UC_0110 bước 5 — máy xay trong <DS>; chọn: trước đó → đang dùng → đầu tiên. */
export function grinderChoice(ds: ShotView[], prev: string | null, current: string | null) {
  const ids = [...new Set(ds.map((v) => v.grinderId).filter((x): x is string => !!x))]
  const selected = prev && ids.includes(prev) ? prev : current && ids.includes(current) ? current : (ids[0] ?? null)
  return { ids, selected }
}

export interface GrindPoint { grind: number; rating: number; ids: string[]; count: number }
/** UC_0110 bước 6 — shot đã thưởng thức, có grind + rating, của máy đang chọn; gộp cùng (grind, rating). */
export function grindPoints(ds: ShotView[], grinderId: string | null): GrindPoint[] {
  const map = new Map<string, GrindPoint>()
  const src = ds
    .filter((v) => v.cup && v.grinderId === grinderId && v.grind != null && rating(v) != null)
    .sort((a, b) => b.brewedAt - a.brewedAt) // ids[0] = shot mới nhất của nhóm ("Mở shot")
  for (const v of src) {
    const k = `${v.grind}|${rating(v)}`
    const p = map.get(k) ?? { grind: v.grind!, rating: rating(v)!, ids: [], count: 0 }
    p.ids.push(v.id)
    p.count++
    map.set(k, p)
  }
  return [...map.values()]
}
/** Số shot vẽ (tính cả shot gộp). */
export const pointShots = (ps: GrindPoint[]) => ps.reduce((s, p) => s + p.count, 0)

/** UC_0110 bước 6 — trục X kẹp trong khoảng grind của máy. */
export function grindDomain(ps: GrindPoint[], grinder?: Pick<Device, 'ranges'> | null): [number, number] {
  const xs = ps.map((p) => p.grind)
  const lo = Math.min(...xs) - 2
  const hi = Math.max(...xs) + 2
  const r = grinder?.ranges.grind
  return [r ? Math.max(r[0], lo) : lo, r ? Math.min(r[1], hi) : hi]
}

export interface RatioPoint { id: string; at: number; ratio: number }
/** UC_0111 bước 2 — mọi shot có Dose, Yield > 0 (kể cả chờ thưởng thức), theo thời gian. */
export const ratioPoints = (ds: ShotView[]): RatioPoint[] =>
  ds
    .filter((v) => v.dose != null && v.dose > 0 && v.yield != null && v.yield > 0)
    .map((v) => ({ id: v.id, at: v.brewedAt, ratio: ratio(v.dose, v.yield)! }))
    .sort((a, b) => a.at - b.at)

/** Bước chia trục "đẹp" (1 · 2 · 2.5 · 5 × 10ⁿ) — như prototype đã duyệt. */
export function niceTicks(a: number, b: number, n: number): number[] {
  if (a === b) [a, b] = [a - 1, b + 1]
  const step0 = (b - a) / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const st = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0)!
  const out: number[] = []
  for (let v = Math.floor(a / st) * st; v <= b + 1e-9; v += st) out.push(Math.round(v * 1000) / 1000)
  if (out[out.length - 1] < b) out.push(Math.round((out[out.length - 1] + st) * 1000) / 1000)
  return out
}
/** Số chữ số lẻ của bước chia — nhãn trục đúng giá trị, không trùng. */
export const tickDecimals = (ticks: number[]) =>
  ticks.length > 1 ? (String(Math.round((ticks[1] - ticks[0]) * 1000) / 1000).split('.')[1] ?? '').length : 1
