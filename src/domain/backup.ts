import type { Bean, Cup, Device, Method, Param, Settings, Shot, Video } from '../data/types'
import { methodName, PARAMS } from './shot'

// MOD_005 — RPT-001 (JSON), RPT-002 (CSV), INT-001 (nhập gộp). Hàm thuần; đọc / ghi file và Blob ở features/backup.

export const FORMAT_VERSION = 1
export const NOT_BACKUP = 'File này không phải bản sao lưu của Shot Tracker. Hãy chọn file .json đã xuất từ app'

/** Ly trong file: ảnh ly là data URL (JPEG / PNG đã thu nhỏ). */
export type CupFile = Omit<Cup, 'photo'> & { photo: string | null }
export interface BackupFile {
  app: 'shot-tracker'
  formatVersion: number
  exportedAt: string
  beans: Bean[]
  devices: Device[]
  builtinOverrides: { id: string; gauge: Device['gauge'] }[]
  shots: Shot[]
  cups: CupFile[]
  videos: (Video & { file: string })[]
  settings: Settings
}

/** RPT-001 — custom đầy đủ; máy có sẵn chỉ phần người dùng đã đổi (thang, lần căn — Q-030 g). */
export function buildBackup(
  d: { beans: Bean[]; devices: Device[]; seed: Device[]; shots: Shot[]; cups: CupFile[]; videos: Video[]; settings: Settings },
  now: Date,
): BackupFile {
  const seedMax = new Map(d.seed.map((s) => [s.id, s.gauge?.max]))
  return {
    app: 'shot-tracker',
    formatVersion: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    beans: d.beans,
    devices: d.devices.filter((x) => !x.builtin),
    builtinOverrides: d.devices
      .filter((x) => x.builtin && x.gauge && (x.gauge.max !== seedMax.get(x.id) || x.gauge.lastCalibration))
      .map((x) => ({ id: x.id, gauge: x.gauge })),
    shots: d.shots,
    cups: d.cups,
    videos: d.videos.map((v) => ({ ...v, file: '[video — không kèm trong JSON]' })),
    settings: d.settings,
  }
}

export const fileName = (now: Date, ext: 'json' | 'csv') => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `shot-tracker-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.${ext}`
}

// ---------- RPT-002 CSV ----------

export const CSV_COLUMNS = [
  'id', 'datetime', 'method', 'bean', 'roaster', 'grinder', 'brewer', 'dose_g', 'yield_g', 'ratio', 'grind', 'time_s', 'temp_c',
  'pressure_bar', 'preinfusion_s', 'rating', 'acidity', 'sweetness', 'bitterness', 'body', 'taste_notes', 'tasted', 'drink',
  'hot_iced', 'milk_type', 'milk_ml', 'milk_temp_c', 'foam', 'water_ml', 'ice_g', 'sugar_syrup', 'sugar_g',
] as const

/** Bao ngoặc kép khi có dấu phẩy, ngoặc kép, xuống dòng; ngoặc kép bên trong nhân đôi. */
export function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const localIso = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** RPT-002 — một dòng mỗi shot, Ngày giờ pha tăng dần; UTF-8 có BOM. */
export function buildCsv(shots: Shot[], cups: Cup[], beans: Bean[], devices: Device[]): string {
  const cupOf = new Map(cups.map((c) => [c.shotId, c]))
  const bean = (id: string) => beans.find((b) => b.id === id)
  const dev = (id: string | null) => {
    const d = id ? devices.find((x) => x.id === id) : undefined
    return d ? `${d.brand} ${d.name}`.trim() : 'Chưa chọn'
  }
  const rows = [...shots]
    .sort((a, b) => a.brewedAt - b.brewedAt)
    .map((s) => {
      const c = cupOf.get(s.id)
      const ratio = s.dose != null && s.dose > 0 && s.yield != null ? (s.yield / s.dose).toFixed(2) : null
      return [
        s.id, localIso(s.brewedAt), methodName(s), bean(s.beanId)?.name, bean(s.beanId)?.roaster, dev(s.grinderId), dev(s.brewerId),
        s.dose, s.yield, ratio, s.grind, s.time, s.temp, s.pressure, s.pre,
        c?.rating, c?.acidity, c?.sweetness, c?.bitterness, c?.body, c?.tasteNotes || null, c ? 'yes' : 'no', c?.drink,
        c?.iced, c?.milkType, c?.milkMl, c?.milkTempC, c?.foam, c?.waterMl, c?.iceG, c?.sugar, c?.sugarG,
      ].map(csvCell).join(',')
    })
  return '\uFEFF' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}

// ---------- INT-001 nhập ----------

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown, def = '') => (typeof x === 'string' ? x : def)
const strOrNull = (x: unknown) => (typeof x === 'string' ? x : null)
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const ts = (x: unknown, def: number) => num(x) ?? def
const pick = <T extends string>(x: unknown, allowed: readonly T[], def: T): T => (allowed.includes(x as T) ? (x as T) : def)
const METHODS: Method[] = ['espresso', 'pourover', 'aeropress', 'moka', 'frenchpress', 'other']
const KINDS: Device['kind'][] = ['grinder', 'espresso', 'pourover', 'aeropress', 'moka', 'frenchpress', 'other']
const IMG = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/

/** UC_0406 bước 2 — đọc + nhận diện file. */
export function parseBackup(text: string): { ok: true; data: Record<string, unknown> } | { ok: false } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (!isObj(data) || data.app !== 'shot-tracker' || !Array.isArray(data.shots)) return { ok: false }
  const v = num(data.formatVersion ?? data.version) ?? 1
  if (v > FORMAT_VERSION) return { ok: false } // file mới hơn app
  return { ok: true, data }
}

/** SEC-008 / SEC-009 — chỉ giữ trường đúng kiểu; chữ giữ là chữ (không bao giờ hiểu là HTML); ảnh chỉ nhận data URL JPEG / PNG. */
export function cleanBean(x: unknown, now: number): Bean | null {
  if (!isObj(x) || typeof x.id !== 'string' || !str(x.name).trim()) return null
  return {
    id: x.id, name: str(x.name), roaster: str(x.roaster), origin: str(x.origin), roastLevel: strOrNull(x.roastLevel), process: strOrNull(x.process),
    roastDate: typeof x.roastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.roastDate) ? x.roastDate : null,
    status: pick(x.status, ['active', 'out'] as const, 'active'), createdAt: ts(x.createdAt, now), updatedAt: ts(x.updatedAt, now),
  }
}
export function cleanDevice(x: unknown, now: number): Device | null {
  if (!isObj(x) || typeof x.id !== 'string' || !str(x.name).trim()) return null
  const ranges: Device['ranges'] = {}
  if (isObj(x.ranges))
    for (const p of PARAMS) {
      const r = x.ranges[p]
      if (Array.isArray(r) && num(r[0]) != null && num(r[1]) != null && r[0] <= r[1]) ranges[p as Param] = [r[0], r[1]]
    }
  const gmax = isObj(x.gauge) ? num(x.gauge.max) : null
  const g = gmax != null && gmax > 0 && gmax <= 30 ? { max: gmax } : null
  return {
    id: x.id, kind: pick(x.kind, KINDS, 'other'), ...(typeof x.kindOther === 'string' ? { kindOther: x.kindOther } : {}),
    brand: str(x.brand), name: str(x.name), methods: Array.isArray(x.methods) ? x.methods.filter((m): m is Method => METHODS.includes(m)) : [],
    op: str(x.op), grindUnit: strOrNull(x.grindUnit), burrType: strOrNull(x.burrType), burrMm: num(x.burrMm), features: str(x.features), conf: null,
    ranges, gauge: g, illustration: str(x.illustration), builtin: false, // nhập vào luôn là custom
    ...(typeof x.clonedFrom === 'string' ? { clonedFrom: x.clonedFrom } : {}),
    status: pick(x.status, ['active', 'hidden'] as const, 'active'), createdAt: ts(x.createdAt, now), updatedAt: ts(x.updatedAt, now),
  }
}
export function cleanShot(x: unknown, now: number): Shot | null {
  if (!isObj(x) || typeof x.id !== 'string' || num(x.brewedAt) == null) return null
  const curve = Array.isArray(x.pressureCurve)
    ? x.pressureCurve
        .filter((p): p is unknown[] => Array.isArray(p) && num(p[0]) != null && num(p[1]) != null)
        .map((p) => [p[0] as number, p[1] as number, num(p[2]) ?? 1, p[3] === 'a' ? 'a' : 'm'] as [number, number, number, 'a' | 'm'])
    : null
  const marks = isObj(x.marks) && num(x.marks.start) != null && num(x.marks.end) != null ? { start: x.marks.start as number, end: x.marks.end as number } : null
  const s: Shot = {
    id: x.id, brewedAt: x.brewedAt as number, method: pick(x.method, METHODS, 'other'), methodOther: strOrNull(x.methodOther),
    beanId: str(x.beanId), grinderId: strOrNull(x.grinderId), brewerId: strOrNull(x.brewerId),
    dose: null, grind: null, grindTime: null, retention: null, temp: null, pressure: null, pre: null, time: null, yield: null,
    barista: str(x.barista), notes: str(x.notes), pressureCurve: curve?.length ? curve : null, marks,
    timeSrc: pick(x.timeSrc, ['video', 'manual'] as const, 'manual'), pressureSrc: pick(x.pressureSrc, ['video', 'manual'] as const, 'manual'),
    createdAt: ts(x.createdAt, now), updatedAt: ts(x.updatedAt, now),
  }
  for (const p of PARAMS) s[p] = num(x[p])
  return s
}
export function cleanCup(x: unknown, now: number): CupFile | null {
  if (!isObj(x) || typeof x.id !== 'string' || typeof x.shotId !== 'string') return null
  const scale = (v: unknown) => { const n = num(v); return n != null && n >= 1 && n <= 10 ? Math.round(n) : null }
  return {
    id: x.id, shotId: x.shotId, cuppedAt: ts(x.cuppedAt, now), updatedAt: ts(x.updatedAt, now),
    drink: str(x.drink, 'Espresso') || 'Espresso', iced: pick(x.iced, ['hot', 'iced'] as const, 'hot'),
    milkType: strOrNull(x.milkType), milkMl: num(x.milkMl), milkTempC: num(x.milkTempC), foam: (['Ít', 'Vừa', 'Nhiều'] as const).find((f) => f === x.foam) ?? null,
    waterMl: num(x.waterMl), iceG: num(x.iceG), sugar: strOrNull(x.sugar), sugarG: num(x.sugarG),
    rating: scale(x.rating), acidity: scale(x.acidity), sweetness: scale(x.sweetness), bitterness: scale(x.bitterness), body: scale(x.body),
    tasteNotes: str(x.tasteNotes), photo: typeof x.photo === 'string' && IMG.test(x.photo) ? x.photo : null,
  }
}

export interface ImportPlan {
  total: { shots: number; beans: number; devices: number }
  beans: Bean[]
  devices: Device[]
  shots: Shot[]
  cups: CupFile[]
  dupShots: number
}

/** UC_0406 bước 3–4 / INT-001 — khoá = Định danh; đã có → giữ bản trên máy; ly chỉ thêm khi shot chưa có ly. */
export function planImport(
  data: Record<string, unknown>,
  have: { shots: Set<string>; beans: Set<string>; devices: Set<string>; cups: Set<string>; cupShots: Set<string> },
  now: number,
): ImportPlan {
  const arr = (k: string) => (Array.isArray(data[k]) ? (data[k] as unknown[]) : [])
  const clean = <T,>(k: string, f: (x: unknown, now: number) => T | null) => arr(k).map((x) => f(x, now)).filter((x): x is T => x != null)
  const allShots = clean('shots', cleanShot)
  const allBeans = clean('beans', cleanBean)
  const allDevices = clean('devices', cleanDevice)
  const shots = allShots.filter((s) => !have.shots.has(s.id))
  const cupShots = new Set(have.cupShots)
  const cups = clean('cups', cleanCup).filter((c) => {
    if (have.cups.has(c.id) || cupShots.has(c.shotId) || !(have.shots.has(c.shotId) || shots.some((s) => s.id === c.shotId))) return false
    cupShots.add(c.shotId)
    return true
  })
  return {
    total: { shots: arr('shots').length, beans: arr('beans').length, devices: arr('devices').length },
    beans: allBeans.filter((b) => !have.beans.has(b.id)),
    devices: allDevices.filter((d) => !have.devices.has(d.id)),
    shots,
    cups,
    dupShots: allShots.length - shots.length,
  }
}
export const confirmText = (p: ImportPlan) =>
  `File có ${p.total.shots} shot, ${p.total.beans} hạt, ${p.total.devices} thiết bị custom. Sẽ thêm ${p.shots.length} shot mới, bỏ qua ${p.dupShots} đã có.`
export const resultText = (p: ImportPlan) =>
  `Đã thêm ${p.shots.length} shot, ${p.beans.length} hạt, ${p.devices.length} thiết bị. Bỏ qua ${p.dupShots} bản đã có`
