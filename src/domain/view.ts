import type { Bean, Cup, Device, Method, Shot } from '../data/types'
import { CUP_NUMS, drinkName, DRINKS, TASTES } from './cup'
import { daysSince, fmt, fmtSec, fromIso, isoDate } from './format'
import { fmtRatio, methodName, paramLabel, ratio } from './shot'

// FE_MOD_006 — dữ liệu xem: shot + ly (BR-12), lọc Lịch sử (UC_0102), nhóm ngày (UC_0101), bảng so sánh (UC_0109).

export type ShotView = Shot & { cup?: Cup }
export const hasCup = (v: ShotView) => !!v.cup
export const rating = (v: ShotView) => v.cup?.rating ?? null

/** Ghép shot với ly, mới nhất trước. */
export function shotViews(shots: Shot[], cups: Cup[]): ShotView[] {
  const byShot = new Map(cups.map((c) => [c.shotId, c]))
  return shots.map((s) => ({ ...s, cup: byShot.get(s.id) })).sort((a, b) => b.brewedAt - a.brewedAt)
}

/** BR-12 — shot chưa có ly. */
export const waiting = (vs: ShotView[]) => vs.filter((v) => !v.cup)

/** UC_0001 bước 4 — công thức lần trước: mới nhất cùng phương pháp mặc định, không có thì mới nhất bất kỳ. */
export const lastRecipe = (vs: ShotView[], defaultMethod: Method) => vs.find((v) => v.method === defaultMethod) ?? vs[0]

export interface HistoryFilter {
  bean: string | null
  rating: number | 'none' | 'waiting' | null
  drinks: string[]
  methods: Method[]
}
export const NO_FILTER: HistoryFilter = { bean: null, rating: null, drinks: [], methods: [] }
export const isFiltered = (f: HistoryFilter) => !!(f.bean || f.rating || f.drinks.length || f.methods.length)

/** UC_0102 bước 1–5 — nhóm VÀ, trong nhóm HOẶC. */
export function applyFilter(vs: ShotView[], f: HistoryFilter): ShotView[] {
  return vs.filter((v) => {
    if (f.bean && v.beanId !== f.bean) return false
    const r = rating(v)
    if (f.rating === 'none' && r != null) return false
    if (f.rating === 'waiting' && v.cup) return false
    if (typeof f.rating === 'number' && (r == null || r < f.rating)) return false
    if (f.drinks.length && (!v.cup || !f.drinks.includes(v.cup.drink))) return false
    if (f.methods.length && !f.methods.includes(v.method)) return false
    return true
  })
}

export interface DayGroup { key: string; at: number; items: ShotView[]; avg: string | null }
/** UC_0101 bước 3 — nhóm theo ngày; TB rating 1 số lẻ khi có shot đã chấm. */
export function groupByDay(vs: ShotView[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const v of vs) {
    const key = isoDate(v.brewedAt)
    const g = groups[groups.length - 1]
    if (g && g.key === key) g.items.push(v)
    else groups.push({ key, at: v.brewedAt, items: [v], avg: null })
  }
  for (const g of groups) {
    const rated = g.items.map(rating).filter((r): r is number => r != null)
    g.avg = rated.length ? (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1) : null
  }
  return groups
}

/** UC_0101 bước 4 — công thức trên thẻ (grind thêm " click" khi máy xay đếm click). */
export function cardRecipe(s: Shot, grinder?: Device): string {
  const parts: string[] = []
  if (s.dose != null || s.yield != null) parts.push(`${fmt(s.dose, 1)} g → ${fmt(s.yield, 1)} g`)
  const r = ratio(s.dose, s.yield)
  if (r) parts.push(fmtRatio(r))
  if (s.time != null) parts.push(fmtSec(s.time))
  if (s.grind != null) parts.push(`grind ${fmt(s.grind, 2)}${grinder?.grindUnit === 'click' ? ' click' : ''}`)
  return parts.join(' · ')
}

/** Nhãn kiểu uống trên thẻ: chỉ khi khác mặc định của phương pháp hoặc uống đá. */
export function cardDrink(v: ShotView): string | null {
  if (!v.cup) return null
  const def = v.method === 'espresso' ? 'Espresso' : 'Đen'
  return v.cup.drink !== def || v.cup.iced === 'iced' ? drinkName(v.cup) : null
}

// ---------- So sánh (UC_0109 bước 5) ----------

export interface CompareRow { label: string; a: string; b: string; diff: boolean; delta?: string }
type Val = string | number | null | undefined
type Field = { label: string; get: (v: ShotView) => Val; kind?: 'num' | 'ratio' | 'time' | 'grind' }

const devName = (d?: Device) => (d ? `${d.brand} ${d.name}` : '—')

export function compareRows(A: ShotView, B: ShotView, beans: Bean[], devices: Device[]): CompareRow[] {
  const bean = (v: ShotView) => beans.find((b) => b.id === v.beanId)
  const dev = (id: string | null) => devices.find((d) => d.id === id)
  const m = A.method // nhãn theo phương pháp của Shot A
  const num = (p: Parameters<typeof paramLabel>[0], kind: Field['kind'] = 'num'): Field => ({ label: paramLabel(p, m), get: (v) => v[p], kind })
  const cupNum = (k: keyof typeof CUP_NUMS): Field => ({ label: CUP_NUMS[k].label, get: (v) => v.cup?.[k], kind: 'num' })
  const fields: Field[] = [
    { label: 'Phương pháp', get: (v) => methodName(v) },
    { label: 'Kiểu uống', get: (v) => (v.cup ? drinkName(v.cup) : 'Chờ thưởng thức') },
    { label: 'Hạt', get: (v) => bean(v)?.name },
    { label: 'Ngày rang', get: (v) => { const rd = bean(v)?.roastDate; return rd ? `${fromIso(rd)} (${daysSince(rd, v.brewedAt)} ngày)` : null } },
    { label: 'Máy xay', get: (v) => (v.grinderId ? devName(dev(v.grinderId)) : null) },
    { label: 'Dụng cụ pha', get: (v) => (v.brewerId ? devName(dev(v.brewerId)) : null) },
    num('dose'),
    num('yield'),
    { label: 'Ratio', get: (v) => ratio(v.dose, v.yield), kind: 'ratio' },
    num('grind', 'grind'),
    num('grindTime'),
    num('retention'),
    num('temp'),
    num('pressure'),
    num('pre'),
    num('time', 'time'),
    { label: 'Rating', get: (v) => rating(v), kind: 'num' },
    { label: 'Loại sữa', get: (v) => v.cup?.milkType },
    cupNum('milkMl'),
    cupNum('milkTempC'),
    { label: 'Độ bọt', get: (v) => v.cup?.foam },
    cupNum('waterMl'),
    cupNum('iceG'),
    { label: 'Đường / syrup', get: (v) => v.cup?.sugar },
    cupNum('sugarG'),
  ]
  const sameGrinder = A.grinderId === B.grinderId
  const show = (x: Val, kind?: Field['kind']) =>
    x == null || x === '' ? '—' : kind === 'ratio' ? fmtRatio(x as number) : kind === 'time' ? fmtSec(x as number) : typeof x === 'number' ? fmt(x) : x
  const rows: CompareRow[] = []
  for (const f of fields) {
    const a = f.get(A)
    const b = f.get(B)
    const empty = (x: Val) => x == null || x === ''
    if (empty(a) && empty(b)) continue
    const bothNum = typeof a === 'number' && typeof b === 'number'
    const diff = bothNum ? Math.abs(a - b) > 1e-9 : show(a, f.kind) !== show(b, f.kind)
    let delta: string | undefined
    if (bothNum && diff) {
      if (f.kind === 'grind' && !sameGrinder) delta = 'khác thang'
      else {
        const d = Math.round((b - a) * 100) / 100
        delta = `${d > 0 ? '+' : ''}${d}`
      }
    }
    rows.push({ label: f.label, a: show(a, f.kind), b: show(b, f.kind), diff, delta })
  }
  return rows
}

/** UC_0109 bước 5 — banner khi khác máy xay. */
export function grinderBanner(A: ShotView, B: ShotView, devices: Device[]): string | null {
  if (A.grinderId === B.grinderId) return null
  const name = (id: string | null) => devices.find((d) => d.id === id)?.name ?? '—'
  return `Hai máy xay khác nhau (${name(A.grinderId)} / ${name(B.grinderId)}) — grind không cùng thang`
}

/** UC_0109 bước 7 — chỉ số vị có ít nhất một bên có giá trị. */
export const compareTastes = (A: ShotView, B: ShotView) =>
  TASTES.filter(([k]) => A.cup?.[k] != null || B.cup?.[k] != null).map(([k, label]) => ({ label, a: A.cup?.[k] ?? null, b: B.cup?.[k] ?? null }))

/** Kiểu uống cho lọc: 8 kiểu + các kiểu "Khác" đã dùng (UC_0102 bước 3). */
export const drinkOptions = (cups: Cup[]) => [...DRINKS, ...new Set(cups.map((c) => c.drink).filter((d) => !DRINKS.includes(d)))]
