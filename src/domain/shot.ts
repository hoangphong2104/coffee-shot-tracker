import type { Device, Method, Param, Settings, Shot } from '../data/types'
import { fmt, fmtSec } from './format'

// MOD_001 — luật shot (UC_0103, UC_0104, UC_0105, UC_0107). Hàm thuần: nhận thiết bị / cài đặt làm tham số.

export const METHODS: { id: Exclude<Method, 'other'>; label: string; short: string }[] = [
  { id: 'espresso', label: 'Espresso', short: 'Espresso' },
  { id: 'pourover', label: 'Pour Over', short: 'Pour Over' },
  { id: 'aeropress', label: 'Aeropress', short: 'Aeropress' },
  { id: 'moka', label: 'Moka Pot', short: 'Moka' },
  { id: 'frenchpress', label: 'French Press', short: 'French' },
]
export const methodLabel = (m: Method) => (m === 'other' ? 'Khác' : METHODS.find((x) => x.id === m)!.label)
export const methodName = (s: { method: Method; methodOther?: string | null }) =>
  s.method === 'other' ? s.methodOther || 'Khác' : methodLabel(s.method)

export const PARAMS: Param[] = ['dose', 'yield', 'grind', 'time', 'temp', 'pressure', 'pre', 'grindTime', 'retention']
export const MAIN4: Param[] = ['dose', 'yield', 'grind', 'time']

const ALL: Method[] = ['espresso', 'pourover', 'aeropress', 'moka', 'frenchpress', 'other']
// BR-01 — thông số áp dụng theo phương pháp
const APPLIES: Record<Param, Method[]> = {
  dose: ALL,
  grind: ALL,
  grindTime: ALL,
  retention: ALL,
  time: ALL,
  yield: ALL,
  temp: ['espresso', 'pourover', 'aeropress', 'frenchpress', 'other'],
  pressure: ['espresso'],
  pre: ['espresso', 'pourover', 'aeropress', 'other'],
}
export const applies = (p: Param, m: Method) => APPLIES[p].includes(m)

/** Thiết bị quyết định khoảng của thông số. */
export const side = (p: Param): 'grinder' | 'brewer' => (p === 'grind' || p === 'grindTime' || p === 'retention' ? 'grinder' : 'brewer')

export function paramLabel(p: Param, m: Method): string {
  switch (p) {
    case 'dose': return 'Dose'
    case 'yield': return m === 'espresso' || m === 'moka' ? 'Yield' : 'Nước'
    case 'grind': return 'Grind'
    case 'time': return m === 'espresso' ? 'Shot time' : m === 'frenchpress' ? 'Thời gian ủ' : 'Thời gian pha'
    case 'temp': return 'Nhiệt độ'
    case 'pressure': return 'Áp suất'
    case 'pre': return m === 'espresso' ? 'Pre-infusion' : 'Bloom'
    case 'grindTime': return 'Grind time'
    case 'retention': return 'Retention'
  }
}
export const UNIT: Record<Param, string> = { dose: 'g', yield: 'g', grind: '', time: 's', temp: '°C', pressure: 'bar', pre: 's', grindTime: 's', retention: 'g' }

/** UC_0103 bước 10 — bước chỉnh số. */
export function paramStep(p: Param, m: Method, grinder?: Device | null): number {
  switch (p) {
    case 'dose': return 0.1
    case 'yield': return m === 'espresso' || m === 'moka' ? 0.5 : 5
    case 'grind': return grinder?.grindUnit === 'vạch dial' ? 0.5 : 1
    case 'pressure': return 0.5
    case 'retention': return 0.05
    default: return 1
  }
}

export type Src = 'video' | 'manual'

export interface ShotForm {
  mode: 'new' | 'edit'
  id?: string
  brewedAt: number
  method: Method
  methodOther: string
  /** Edit: phương pháp lúc mở — nhãn cho cảnh báo thông số bị bỏ (BR-07). */
  origMethod?: Method
  /** Edit: thông số shot đã có giá trị — vẫn hiện dù đang tắt / thiết bị không còn khoảng (BR-03). */
  keep: Param[]
  beanId?: string
  grinderId: string | null
  brewerId: string | null
  vals: Partial<Record<Param, string>>
  /** Ô đã sửa tay (không còn chữ nhạt "điền sẵn"). */
  touched: Param[]
  barista: string
  notes: string
  pressureCurve?: Shot['pressureCurve']
  marks?: Shot['marks']
  src: { time?: Src; pressure?: Src }
}

export interface FieldError { field: Param | 'bean'; message: string; deviceId?: string }

type Tracked = Settings['tracked']
const isTracked = (tracked: Tracked, k: string) => tracked[k] !== false
const byId = (devices: Device[], id: string | null | undefined) => (id ? devices.find((d) => d.id === id) ?? null : null)
export const formDevices = (f: Pick<ShotForm, 'grinderId' | 'brewerId'>, devices: Device[]) => ({
  grinder: byId(devices, f.grinderId),
  brewer: byId(devices, f.brewerId),
})
const deviceFor = (p: Param, d: { grinder: Device | null; brewer: Device | null }) => (side(p) === 'grinder' ? d.grinder : d.brewer)

/** UC_0103 bước 5 (+ UC_0107 bước 3): thông số đang hiện. */
export function visibleParams(f: Pick<ShotForm, 'method' | 'grinderId' | 'brewerId' | 'mode' | 'keep'>, devices: Device[], tracked: Tracked): Param[] {
  const d = formDevices(f, devices)
  return PARAMS.filter((p) => {
    if (!applies(p, f.method)) return false
    if (f.mode === 'edit' && f.keep.includes(p)) return true // BR-03
    const dev = deviceFor(p, d)
    return isTracked(tracked, p) && (dev == null || dev.ranges[p] != null)
  })
}

export const rangeOf = (p: Param, f: Pick<ShotForm, 'grinderId' | 'brewerId'>, devices: Device[]) => {
  const dev = deviceFor(p, formDevices(f, devices))
  const r = dev?.ranges[p]
  return r ? { min: r[0], max: r[1], device: dev! } : null
}

const activeId = (devices: Device[], id: string | null | undefined, method?: Method) => {
  const d = byId(devices, id)
  return d && d.status === 'active' && (!method || d.methods.includes(method)) ? d.id : null
}
const brewerFor = (settings: Settings, devices: Device[], m: Method) =>
  m === 'other' ? null : activeId(devices, settings.current[m], m)

/** UC_0103 bước 1–8. Có `fromShot` → UC_0105 (chép, không áp mặc định). */
export function newShotForm(settings: Settings, devices: Device[], now: number, fromShot?: Shot): ShotForm {
  const base: ShotForm = {
    mode: 'new',
    brewedAt: now,
    method: settings.defaultMethod,
    methodOther: '',
    keep: [],
    grinderId: null,
    brewerId: null,
    vals: {},
    touched: [],
    barista: settings.baristaDefault ?? '',
    notes: '',
    src: {},
  }
  if (fromShot) return applyReuse(base, fromShot)
  const f = {
    ...base,
    grinderId: activeId(devices, settings.current.grinder),
    brewerId: brewerFor(settings, devices, settings.defaultMethod),
  }
  return { ...f, vals: defaultsFor(f, settings, devices) }
}

/** DO_007 — giá trị điền sẵn cho thông số đang hiện, chỉ ô chưa sửa tay. */
function defaultsFor(f: ShotForm, settings: Settings, devices: Device[]): ShotForm['vals'] {
  const vals: ShotForm['vals'] = {}
  const defs = settings.defaults[f.method] ?? {}
  for (const p of visibleParams(f, devices, settings.tracked)) {
    if (f.touched.includes(p)) vals[p] = f.vals[p]
    else if (defs[p] != null) vals[p] = String(defs[p])
  }
  for (const p of f.touched) vals[p] = f.vals[p]
  return vals
}

/** BR-04 v1.3 — UC_0104 bước 3, UC_0105 bước 3. */
export function applyReuse(f: ShotForm, s: Shot): ShotForm {
  const vals: ShotForm['vals'] = {}
  const touched: Param[] = []
  for (const p of PARAMS) {
    const v = s[p]
    if (v != null) {
      vals[p] = String(v)
      touched.push(p)
    }
  }
  return {
    ...f,
    beanId: s.beanId, // kể cả hạt Đã hết / máy Ẩn (Q-029 b)
    grinderId: s.grinderId,
    brewerId: s.brewerId,
    method: s.method,
    methodOther: s.methodOther ?? '',
    barista: s.barista,
    vals,
    touched,
    src: { time: 'manual', pressure: 'manual' }, // số chép = Gõ tay (UC_0104 bước 3)
  }
}

/** UC_0107 bước 1–2 — form sửa từ shot đã lưu. */
export function editShotForm(s: Shot): ShotForm {
  const keep = PARAMS.filter((p) => s[p] != null)
  return {
    mode: 'edit',
    id: s.id,
    brewedAt: s.brewedAt,
    method: s.method,
    methodOther: s.methodOther ?? '',
    origMethod: s.method,
    keep,
    beanId: s.beanId,
    grinderId: s.grinderId,
    brewerId: s.brewerId,
    vals: Object.fromEntries(keep.map((p) => [p, String(s[p])])),
    touched: keep,
    barista: s.barista,
    notes: s.notes,
    pressureCurve: s.pressureCurve ?? null,
    marks: s.marks ?? null,
    src: { time: s.timeSrc ?? undefined, pressure: s.pressureSrc ?? undefined },
  }
}

/** UC_0103 bước 9; UC_0107 bước 5. */
export function changeMethod(f: ShotForm, m: Method, settings: Settings, devices: Device[], methodOther = f.methodOther): ShotForm {
  const g = byId(devices, f.grinderId)
  const next: ShotForm = {
    ...f,
    method: m,
    methodOther: m === 'other' ? methodOther : '',
    grinderId: g && g.methods.includes(m) ? g.id : activeId(devices, settings.current.grinder),
    brewerId: brewerFor(settings, devices, m),
  }
  if (f.mode === 'new') next.vals = defaultsFor(next, settings, devices)
  return next
}

/** UC_0107 bước 5 / BR-07 — thông số có giá trị nhưng không áp dụng cho phương pháp mới. */
export function droppedParams(f: ShotForm): Param[] {
  if (f.mode !== 'edit') return []
  return PARAMS.filter((p) => (f.vals[p] ?? '').trim() !== '' && !applies(p, f.method))
}
export const droppedBanner = (f: ShotForm) => {
  const d = droppedParams(f)
  return d.length
    ? `${d.map((p) => paramLabel(p, f.origMethod ?? f.method)).join(', ')} sẽ bị bỏ khi lưu vì không dùng cho ${methodName(f)}`
    : null
}

/** "," → "."; trống → null; không phải số → NaN. */
export function parseNumber(text: string | undefined | null): number | null {
  const t = String(text ?? '').trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

/** UC_0103 bước 15 (UC_0107 bước 8) — gom tất cả lỗi. */
export function validateShot(f: ShotForm, devices: Device[], tracked: Tracked): FieldError[] {
  const errors: FieldError[] = []
  if (!f.beanId) errors.push({ field: 'bean', message: 'Chọn hạt cho shot này' })
  for (const p of visibleParams(f, devices, tracked)) {
    const v = parseNumber(f.vals[p])
    if (v == null) continue
    if (Number.isNaN(v)) {
      errors.push({ field: p, message: 'Nhập số, VD 18.5' })
      continue
    }
    const r = rangeOf(p, f, devices) // thiết bị "Chưa chọn" → không kiểm khoảng (BR-02)
    if (r && (v < r.min || v > r.max))
      errors.push({ field: p, message: `${paramLabel(p, f.method)} phải từ ${r.min} đến ${r.max} (${r.device.name})`, deviceId: r.device.id })
  }
  return errors
}

/** UC_0103 bước 17. */
export function summaryToast(errors: FieldError[]): string {
  const n = errors.filter((e) => e.field !== 'bean').length
  return n ? `Có ${n} giá trị ngoài khoảng của thiết bị. Sửa lại hoặc đổi thiết bị` : 'Chọn hạt cho shot này'
}

/** UC_0103 bước 19; UC_0107 bước 10. */
export function toShotRecord(f: ShotForm, devices: Device[], tracked: Tracked, now: number, newId: () => string, existing?: Shot): Shot {
  const vis = visibleParams(f, devices, tracked)
  const num = (p: Param) => {
    const v = parseNumber(f.vals[p])
    return vis.includes(p) && v != null && !Number.isNaN(v) ? v : null // BR-07: không áp dụng / không hiện → rỗng
  }
  return {
    id: existing?.id ?? newId(),
    brewedAt: existing?.brewedAt ?? f.brewedAt,
    method: f.method,
    methodOther: f.method === 'other' ? f.methodOther.trim() || null : null,
    beanId: f.beanId!,
    grinderId: f.grinderId ?? null,
    brewerId: f.method === 'other' ? null : (f.brewerId ?? null),
    dose: num('dose'),
    grind: num('grind'),
    grindTime: num('grindTime'),
    retention: num('retention'),
    temp: num('temp'),
    pressure: num('pressure'),
    pre: num('pre'),
    time: num('time'),
    yield: num('yield'),
    barista: f.barista.trim(),
    notes: f.notes,
    pressureCurve: f.pressureCurve ?? null,
    marks: f.marks ?? null,
    timeSrc: f.src.time ?? 'manual',
    pressureSrc: f.src.pressure ?? 'manual',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

/** BR-05 — Ratio tính khi hiển thị, không lưu. */
export const ratio = (dose: number | null | undefined, yld: number | null | undefined) =>
  dose != null && dose > 0 && yld != null ? yld / dose : null
export const fmtRatio = (r: number | null) => (r == null ? '—' : '1:' + (r >= 10 ? r.toFixed(1) : r.toFixed(2)).replace(/\.?0+$/, ''))
/** TERM-004 — kiểu theo ratio (chỉ Espresso). */
export function ratioStyle(r: number | null, m: Method): string {
  if (r == null || m !== 'espresso') return ''
  return r < 1.5 ? 'Ristretto' : r <= 2.5 ? 'Normale' : r <= 3.5 ? 'Lungo' : 'Rất loãng'
}

const decimals = (n: number) => (String(n).split('.')[1] ?? '').length
/** SC_0102 v2.0 — hai số kế bên của hàng chỉnh số. */
export function wheelSides(value: string | undefined, step: number): [string, string] {
  const v = parseNumber(value)
  if (v == null || Number.isNaN(v)) return ['−', '+']
  const dp = decimals(step)
  const lo = v - step
  return [lo < 0 ? '' : lo.toFixed(dp), (v + step).toFixed(dp)]
}
/** UC_0103 bước 10 — giá trị sau một bước; không xuống dưới 0. */
export function stepValue(value: string | undefined, step: number, dir: 1 | -1): string {
  const v = parseNumber(value)
  const base = v == null || Number.isNaN(v) ? 0 : v
  const n = Math.max(0, Math.round((base + step * dir) * 1000) / 1000)
  return String(n)
}

/** Công thức một dòng: "18.5 g → 37 g · 1:2 · 30s · grind 13". */
export function recipe(s: Pick<Shot, 'dose' | 'yield' | 'time' | 'grind'>): string {
  const parts: string[] = []
  if (s.dose != null || s.yield != null) parts.push(`${fmt(s.dose, 1)} g → ${fmt(s.yield, 1)} g`)
  const r = ratio(s.dose, s.yield)
  if (r) parts.push(fmtRatio(r))
  if (s.time != null) parts.push(fmtSec(s.time))
  if (s.grind != null) parts.push(`grind ${fmt(s.grind, 2)}`)
  return parts.join(' · ')
}
