import type { Device, DeviceKind, DeviceSlot, Method, Param, Range, Settings, Shot } from '../data/types'
import { fold } from './format'
import { methodLabel, paramLabel, parseNumber, UNIT } from './shot'

// UC_0301..UC_0307 + UC_0401 bước 4 — thiết bị (DO_003) và khoảng hợp lệ (DO_004).

export const KIND_ORDER: DeviceKind[] = ['grinder', 'espresso', 'pourover', 'aeropress', 'moka', 'frenchpress', 'other']
export const KIND_LABEL: Record<DeviceKind, string> = {
  grinder: 'Máy xay', espresso: 'Máy espresso', pourover: 'Dụng cụ pour over', aeropress: 'Aeropress', moka: 'Moka Pot', frenchpress: 'French Press', other: 'Khác',
}
export const kindName = (d: Pick<Device, 'kind' | 'kindOther'>) => (d.kind === 'other' ? d.kindOther || 'Khác' : KIND_LABEL[d.kind])
export const devName = (d?: Pick<Device, 'brand' | 'name'> | null) => (d ? `${d.brand} ${d.name}`.trim() : 'Chưa chọn')
export const ALL_METHODS: Exclude<Method, 'other'>[] = ['espresso', 'pourover', 'aeropress', 'moka', 'frenchpress']
export const GRIND_UNITS = ['vạch dial', 'click', 'số']
export const BURRS = ['Phẳng', 'Côn']

/** Thông số theo loại thiết bị. */
export const KIND_PARAMS: Record<DeviceKind, Param[]> = {
  grinder: ['grind', 'grindTime', 'retention'],
  espresso: ['dose', 'temp', 'pressure', 'pre', 'time', 'yield'],
  pourover: ['dose', 'temp', 'pre', 'time', 'yield'],
  aeropress: ['dose', 'temp', 'pre', 'time', 'yield'],
  moka: ['dose', 'time', 'yield'],
  frenchpress: ['dose', 'temp', 'time', 'yield'],
  other: ['dose', 'temp', 'pre', 'time', 'yield'],
}
/** UC_0303 bước 1 — khoảng mặc định theo loại (Derived theo prototype — SRC-018). */
export const DEFAULT_RANGES: Record<DeviceKind, Partial<Record<Param, Range>>> = {
  grinder: { grind: [0, 100], grindTime: [0, 120], retention: [0, 5] },
  espresso: { dose: [7, 25], temp: [80, 100], pressure: [0, 16], pre: [0, 30], time: [5, 120], yield: [5, 120] },
  pourover: { dose: [5, 60], temp: [70, 100], pre: [0, 120], time: [30, 600], yield: [50, 1000] },
  aeropress: { dose: [5, 35], temp: [60, 100], pre: [0, 120], time: [10, 600], yield: [50, 300] },
  moka: { dose: [5, 40], time: [30, 900], yield: [20, 400] },
  frenchpress: { dose: [5, 80], temp: [70, 100], time: [60, 1200], yield: [100, 1500] },
  other: { dose: [5, 60], temp: [60, 100], pre: [0, 120], time: [10, 1200], yield: [10, 1000] },
}
/** Nhãn thông số theo loại (dụng cụ dùng nhãn của phương pháp tương ứng; Khác dùng nhãn chung). */
export const rangeLabel = (p: Param, kind: DeviceKind) =>
  p === 'grind' ? 'Grind size' : paramLabel(p, kind === 'grinder' || kind === 'other' ? 'pourover' : (kind as Method))
export const rangeUnit = (p: Param, d: Pick<Device, 'grindUnit'>) => (p === 'grind' ? d.grindUnit ?? '' : UNIT[p])
export const CONF_LABEL: Record<string, string> = { N: 'Theo nguồn', H: 'Theo hãng (chưa kiểm chứng)', 'Ư': 'Ước lượng' }

/** UC_0401 bước 4 — ô "đang dùng" của thiết bị. */
export function slotFor(d: Pick<Device, 'kind' | 'methods'>): DeviceSlot {
  if (d.kind === 'grinder') return 'grinder'
  const m = d.methods.find((x) => x !== 'other')
  return (m ?? 'pourover') as DeviceSlot
}
export const slotLabel = (s: DeviceSlot) => (s === 'grinder' ? 'máy xay' : `dụng cụ ${methodLabel(s)}`)
export const isCurrent = (settings: Settings, id: string) => Object.values(settings.current).includes(id)

// ---------- Danh sách (UC_0301) ----------

export interface DeviceListFilter { q: string; kind: DeviceKind | ''; hidden: boolean }
export function deviceGroups(devices: Device[], section: 'grinder' | 'brewer', f: DeviceListFilter, settings: Settings) {
  const q = fold(f.q.trim())
  const list = devices.filter(
    (d) =>
      (f.hidden || d.status === 'active') &&
      (section === 'grinder' ? d.kind === 'grinder' : d.kind !== 'grinder') &&
      (!f.kind || d.kind === f.kind) &&
      (!q || fold(`${d.brand} ${d.name}`).includes(q)),
  )
  const cur = (d: Device) => (isCurrent(settings, d.id) ? 0 : 1)
  return KIND_ORDER.filter((k) => list.some((d) => d.kind === k)).map((k) => ({
    kind: k,
    items: list
      .filter((d) => d.kind === k)
      .sort((a, b) => cur(a) - cur(b) || a.brand.localeCompare(b.brand, 'vi') || a.name.localeCompare(b.name, 'vi')),
  }))
}

// ---------- Form thêm / sửa / nhân bản (UC_0303, UC_0304, UC_0306) ----------

export interface DeviceForm {
  kind: DeviceKind
  kindOther: string
  name: string
  brand: string
  methods: Method[]
  op: string
  features: string
  grindUnit: string
  burrType: string | null
  burrMm: string
  gauge: boolean
  gaugeMax: string
  illustration: string
  /** Khoảng đang bật; giá trị là chữ trên ô Từ / Đến. */
  ranges: Partial<Record<Param, [string, string]>>
  clonedFrom?: string
}

const methodsFor = (k: DeviceKind): Method[] => (k === 'grinder' ? [...ALL_METHODS] : k === 'other' ? [] : [k as Method])
const rangesText = (r: Partial<Record<Param, Range>>) =>
  Object.fromEntries(Object.entries(r).map(([p, v]) => [p, [String(v![0]), String(v![1])]])) as DeviceForm['ranges']

export function newDeviceForm(name = ''): DeviceForm {
  return {
    kind: 'grinder', kindOther: '', name, brand: '', methods: [...ALL_METHODS], op: '', features: '',
    grindUnit: 'vạch dial', burrType: null, burrMm: '', gauge: false, gaugeMax: '15', illustration: '',
    ranges: rangesText(DEFAULT_RANGES.grinder),
  }
}
export function formFromDevice(d: Device, clone = false): DeviceForm {
  return {
    kind: d.kind, kindOther: d.kindOther ?? '', name: clone ? `${d.name} (của tôi)` : d.name, brand: d.brand, methods: [...d.methods],
    op: d.op ?? '', features: d.features ?? '', grindUnit: d.grindUnit ?? 'vạch dial', burrType: d.burrType ?? null,
    burrMm: d.burrMm != null ? String(d.burrMm) : '', gauge: !!d.gauge, gaugeMax: String(d.gauge?.max ?? 15),
    illustration: d.illustration ?? '', ranges: rangesText(d.ranges), clonedFrom: clone ? d.id : d.clonedFrom,
  }
}
/** UC_0303 bước 2 — đổi loại: khoảng mặc định + phương pháp của loại. */
export const changeKind = (f: DeviceForm, kind: DeviceKind, kindOther = ''): DeviceForm => ({
  ...f, kind, kindOther: kind === 'other' ? kindOther : '', methods: methodsFor(kind), ranges: rangesText(DEFAULT_RANGES[kind]),
  gauge: false, gaugeMax: '15', illustration: '',
})
/** UC_0303 bước 7 — bật lại công tắc → khoảng mặc định. */
export const toggleRange = (f: DeviceForm, p: Param, on: boolean): DeviceForm => {
  const ranges = { ...f.ranges }
  if (on) ranges[p] = (rangesText({ [p]: DEFAULT_RANGES[f.kind][p] ?? [0, 0] }) as DeviceForm['ranges'])[p]
  else delete ranges[p]
  return { ...f, ranges }
}
/** UC_0303 bước 5 — bật đồng hồ áp → thang = cận trên Áp suất (mặc định 15). */
export const toggleGauge = (f: DeviceForm, on: boolean): DeviceForm => ({ ...f, gauge: on, gaugeMax: on ? f.ranges.pressure?.[1] || '15' : f.gaugeMax })

export type DeviceErrors = Partial<Record<'name' | 'methods' | `r_${Param}`, string>>
/** UC_0303 bước 8. */
export function validateDevice(f: DeviceForm): DeviceErrors {
  const e: DeviceErrors = {}
  if (!f.name.trim()) e.name = 'Nhập tên thiết bị'
  if (!f.methods.length) e.methods = 'Chọn ít nhất một phương pháp'
  for (const p of KIND_PARAMS[f.kind]) {
    const r = f.ranges[p]
    if (!r) continue
    const [a, b] = r.map(parseNumber)
    if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) e[`r_${p}`] = `Nhập đủ khoảng cho ${rangeLabel(p, f.kind)}`
    else if (a > b) e[`r_${p}`] = "Giá trị 'Từ' phải nhỏ hơn hoặc bằng 'Đến'"
  }
  return e
}

/** UC_0303 bước 9–10 (tạo / nhân bản) và UC_0304 bước 4–5 (sửa: giữ id, loại, nguồn, nhân bản từ, trạng thái, ngày tạo, lần căn). */
export function toDeviceRecord(f: DeviceForm, now: number, newId: () => string, existing?: Device): Device {
  const num = (s: string) => {
    const v = parseNumber(s)
    return v == null || Number.isNaN(v) ? null : v
  }
  const ranges: Device['ranges'] = {}
  for (const p of KIND_PARAMS[f.kind]) {
    const r = f.ranges[p]
    if (r) ranges[p] = [num(r[0])!, num(r[1])!]
  }
  const gmax = num(f.gaugeMax)
  const prevMax = existing?.gauge?.max ?? 15
  const kind = existing?.kind ?? f.kind
  const grinder = kind === 'grinder'
  return {
    id: existing?.id ?? newId(),
    kind,
    ...(kind === 'other' ? { kindOther: existing?.kindOther ?? f.kindOther.trim() } : {}),
    brand: f.brand.trim(),
    name: f.name.trim(),
    methods: f.methods,
    op: f.op.trim(),
    features: f.features.trim(),
    grindUnit: grinder ? f.grindUnit : null,
    burrType: grinder ? f.burrType : null,
    burrMm: grinder ? num(f.burrMm) : null,
    conf: null,
    ranges,
    // Thang không phải số trong (0, 30] → giữ giá trị trước đó (UC_0303 bước 8)
    gauge:
      kind === 'espresso' && f.gauge
        ? {
            max: gmax != null && gmax > 0 && gmax <= 30 ? gmax : prevMax,
            ...(existing?.gauge?.lastCalibration ? { lastCalibration: existing.gauge.lastCalibration } : {}),
          }
        : null,
    illustration: f.illustration,
    builtin: false,
    ...(existing?.clonedFrom ?? f.clonedFrom ? { clonedFrom: existing?.clonedFrom ?? f.clonedFrom } : {}),
    status: existing?.status ?? 'active',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

/** UC_0304 bước 1 — số shot dùng thiết bị. */
export const shotsUsing = (shots: Pick<Shot, 'grinderId' | 'brewerId'>[], id: string) =>
  shots.filter((s) => s.grinderId === id || s.brewerId === id).length

/** UC_0302 bước 7 — thang đồng hồ hợp lệ trong (0, 30]. */
export function parseGaugeMax(text: string): number | null {
  const v = parseNumber(text)
  return v != null && !Number.isNaN(v) && v > 0 && v <= 30 ? v : null
}
