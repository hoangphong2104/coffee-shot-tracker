// Kiểu dữ liệu theo database-design-v1 (TBL-001..TBL-009) — tên field theo thuộc tính DO_001..DO_009.

export type Method = 'espresso' | 'pourover' | 'aeropress' | 'moka' | 'frenchpress' | 'other'
export type DeviceKind = 'grinder' | 'espresso' | 'pourover' | 'aeropress' | 'moka' | 'frenchpress' | 'other'
export type Param = 'dose' | 'grind' | 'grindTime' | 'retention' | 'temp' | 'pressure' | 'pre' | 'time' | 'yield'
export type Range = [min: number, max: number]
export type Pt = [x: number, y: number]

export interface Calibration { c: Pt; z: Pt; m: Pt }

/** TBL-001 — DO_001 Hạt cà phê */
export interface Bean {
  id: string
  name: string
  roaster?: string
  origin?: string
  roastLevel?: string | null
  process?: string | null
  roastDate?: string | null // yyyy-MM-dd
  status: 'active' | 'out'
  createdAt: number
  updatedAt: number
}

/** TBL-003 — DO_003 Thiết bị (+ TBL-004 khoảng nhúng trong `ranges`) */
export interface Device {
  id: string
  kind: DeviceKind
  kindOther?: string
  brand: string
  name: string
  methods: Method[]
  op: string
  grindUnit: 'vạch dial' | 'click' | 'số' | string | null
  burrType: string | null
  burrMm: number | null
  features: string
  conf?: 'N' | 'H' | 'Ư' | null
  ranges: Partial<Record<Param, Range>>
  gauge: { max: number; lastCalibration?: Calibration } | null
  illustration: string
  builtin: boolean
  clonedFrom?: string
  status: 'active' | 'hidden'
  createdAt?: number
  updatedAt?: number
}

/** TBL-002 — DO_002 Shot */
export interface Shot {
  id: string
  brewedAt: number
  method: Method
  methodOther?: string | null
  beanId: string
  grinderId: string | null
  brewerId: string | null
  dose: number | null
  grind: number | null
  grindTime: number | null
  retention: number | null
  temp: number | null
  pressure: number | null
  pre: number | null
  time: number | null
  yield: number | null
  barista: string
  notes: string
  pressureCurve?: [t: number, bar: number, conf: number, src: 'a' | 'm'][] | null
  marks?: { start: number; end: number } | null
  timeSrc?: 'video' | 'manual' | null
  pressureSrc?: 'video' | 'manual' | null
  createdAt: number
  updatedAt: number
}

/** TBL-006 — DO_008 Ly thưởng thức (một shot tối đa một ly: index &shotId) */
export interface Cup {
  id: string
  shotId: string
  cuppedAt: number
  drink: string
  iced: 'hot' | 'iced'
  milkType?: string | null
  milkMl?: number | null
  milkTempC?: number | null
  foam?: 'Ít' | 'Vừa' | 'Nhiều' | null
  waterMl?: number | null
  iceG?: number | null
  sugar?: string | null
  sugarG?: number | null
  rating?: number | null
  acidity?: number | null
  sweetness?: number | null
  bitterness?: number | null
  body?: number | null
  tasteNotes?: string
  photo?: Blob | null
  updatedAt: number
}

/** TBL-007 — DO_009 Video chiết xuất (metadata); file ở TBL-008 */
export interface Video {
  id: string
  shotId: string
  durationS: number
  sizeBytes: number
  mime: string
  recordedAt: number
  calibration?: Calibration | null
  marks?: { start: number; end: number } | null
}

/** TBL-008 */
export interface VideoBlob { videoId: string; blob: Blob }

export type DeviceSlot = 'grinder' | 'espresso' | 'pourover' | 'aeropress' | 'moka' | 'frenchpress'

/** TBL-005 — DO_005 + DO_006 + DO_007 (một bản ghi id = 'main') */
export interface Settings {
  id: 'main'
  current: Record<DeviceSlot, string | null>
  defaultMethod: Exclude<Method, 'other'>
  baristaDefault: string
  theme: 'system' | 'light' | 'dark'
  tracked: Partial<Record<string, boolean>> // không có khoá = đang bật (DO_006 mặc định bật hết)
  defaults: Partial<Record<Method, Partial<Record<Param, number>>>>
  catalogVersion: number
  installHintHidden: boolean
  updatedAt: number
}

/** TBL-009 */
export interface Meta { key: string; value: unknown }

export interface InitLogEntry {
  at: number
  result: 'Lần đầu' | 'Không đổi' | 'Cập nhật danh mục' | 'Lỗi'
  fromVersion?: number
  toVersion?: number
  added?: number
  updated?: number
  error?: string
}
