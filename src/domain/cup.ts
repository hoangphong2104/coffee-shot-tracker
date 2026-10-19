import type { Cup, Method, Settings } from '../data/types'
import { parseNumber } from './shot'

// MOD_002 — luật ly thưởng thức (UC_0114, UC_0115). BR-09 nhóm theo kiểu uống, BR-11 khoảng số.

export const DRINKS = ['Espresso', 'Americano', 'Latte', 'Cappuccino', 'Flat white', 'Cortado', 'Macchiato', 'Đen']
export const MILK_DRINKS = ['Latte', 'Cappuccino', 'Flat white', 'Cortado', 'Macchiato']
export const MILKS = ['Sữa tươi', 'Sữa tươi ít béo', 'Sữa yến mạch', 'Sữa đậu nành']
export const FOAMS = ['Ít', 'Vừa', 'Nhiều'] as const
export const SUGARS = ['Đường cát', 'Đường nâu', 'Syrup vanilla', 'Syrup caramel', 'Sữa đặc']
export const TASTES = [
  ['acidity', 'Acidity'],
  ['sweetness', 'Sweetness'],
  ['bitterness', 'Bitterness'],
  ['body', 'Body'],
] as const
export type TasteKey = (typeof TASTES)[number][0]

export type CupNum = 'milkMl' | 'milkTempC' | 'waterMl' | 'iceG' | 'sugarG'
/** BR-11 — nhãn, khoảng, đơn vị, khoá DO_006. */
export const CUP_NUMS: Record<CupNum, { label: string; min: number; max: number; unit: string; tracked: string }> = {
  milkMl: { label: 'Lượng sữa', min: 0, max: 1000, unit: 'ml', tracked: 'milkMl' },
  milkTempC: { label: 'Nhiệt độ sữa', min: 0, max: 90, unit: '°C', tracked: 'milkTemp' },
  waterMl: { label: 'Nước thêm', min: 0, max: 1000, unit: 'ml', tracked: 'water' },
  iceG: { label: 'Đá', min: 0, max: 500, unit: 'g', tracked: 'ice' },
  sugarG: { label: 'Lượng đường / syrup', min: 0, max: 200, unit: 'g', tracked: 'sugar' },
}

export interface CupForm {
  shotId: string
  drink: string
  iced: 'hot' | 'iced'
  milkType?: string | null
  foam?: Cup['foam']
  vals: Partial<Record<CupNum, string>>
  sugar: string
  rating?: number | null
  acidity?: number | null
  sweetness?: number | null
  bitterness?: number | null
  body?: number | null
  tasteNotes: string
  photo?: Blob | null
}

/** UC_0114 bước 3. */
export const defaultDrink = (m: Method) => (m === 'espresso' ? 'Espresso' : 'Đen')
export const drinkName = (c: Pick<Cup, 'drink' | 'iced'>) => `${c.drink}${c.iced === 'iced' ? ' đá' : ''}`

export const newCupForm = (shotId: string, method: Method): CupForm => ({
  shotId,
  drink: defaultDrink(method),
  iced: 'hot',
  vals: {},
  sugar: '',
  tasteNotes: '',
})

export function cupFormFrom(c: Cup): CupForm {
  const vals: CupForm['vals'] = {}
  for (const k of Object.keys(CUP_NUMS) as CupNum[]) if (c[k] != null) vals[k] = String(c[k])
  return {
    shotId: c.shotId,
    drink: c.drink,
    iced: c.iced,
    milkType: c.milkType ?? null,
    foam: c.foam ?? null,
    vals,
    sugar: c.sugar ?? '',
    rating: c.rating ?? null,
    acidity: c.acidity ?? null,
    sweetness: c.sweetness ?? null,
    bitterness: c.bitterness ?? null,
    body: c.body ?? null,
    tasteNotes: c.tasteNotes ?? '',
    photo: c.photo ?? null,
  }
}

/** BR-09 — nhóm hiện theo kiểu uống / nóng–đá. */
export function groups(f: Pick<CupForm, 'drink' | 'iced'>) {
  const custom = !DRINKS.includes(f.drink)
  return {
    milk: MILK_DRINKS.includes(f.drink) || custom,
    water: f.drink === 'Americano' || custom,
    ice: f.iced === 'iced',
  }
}

/** Ô số đang hiện (BR-09 ∧ DO_006). */
export function visibleCupNums(f: Pick<CupForm, 'drink' | 'iced'>, tracked: Settings['tracked']): CupNum[] {
  const g = groups(f)
  const on = (k: CupNum) => tracked[CUP_NUMS[k].tracked] !== false
  const list: CupNum[] = []
  if (g.milk) list.push('milkMl', 'milkTempC')
  if (g.water) list.push('waterMl')
  if (g.ice) list.push('iceG')
  list.push('sugarG')
  return list.filter(on)
}

/** BR-11 — UC_0114 bước 12. */
export function validateCup(f: CupForm, tracked: Settings['tracked']): { field: CupNum; message: string }[] {
  const errs: { field: CupNum; message: string }[] = []
  for (const k of visibleCupNums(f, tracked)) {
    const v = parseNumber(f.vals[k])
    if (v == null) continue
    const r = CUP_NUMS[k]
    if (Number.isNaN(v)) errs.push({ field: k, message: 'Nhập số, VD 180' })
    else if (v < r.min || v > r.max) errs.push({ field: k, message: `${r.label} phải từ ${r.min} đến ${r.max}` })
  }
  return errs
}

/** UC_0114 bước 13; UC_0115 bước 6 (giữ id, shotId, cuppedAt). */
export function toCupRecord(f: CupForm, tracked: Settings['tracked'], now: number, newId: () => string, existing?: Cup): Cup {
  const g = groups(f)
  const vis = visibleCupNums(f, tracked)
  const num = (k: CupNum) => {
    const v = parseNumber(f.vals[k])
    return vis.includes(k) && v != null && !Number.isNaN(v) ? v : null
  }
  return {
    id: existing?.id ?? newId(),
    shotId: f.shotId,
    cuppedAt: existing?.cuppedAt ?? now,
    updatedAt: now,
    drink: f.drink,
    iced: f.iced,
    milkType: g.milk ? (f.milkType ?? null) : null,
    foam: g.milk ? (f.foam ?? null) : null,
    milkMl: num('milkMl'),
    milkTempC: num('milkTempC'),
    waterMl: num('waterMl'),
    iceG: num('iceG'),
    sugar: f.sugar.trim() || null,
    sugarG: num('sugarG'),
    rating: f.rating ?? null,
    acidity: f.acidity ?? null,
    sweetness: f.sweetness ?? null,
    bitterness: f.bitterness ?? null,
    body: f.body ?? null,
    tasteNotes: f.tasteNotes,
    photo: f.photo ?? null,
  }
}

/** UC_0106 bước 4 — các dòng công thức của ly. */
export function cupLines(c: Cup): string[] {
  const lines: string[] = []
  const milk = [c.milkType || (c.milkMl != null || c.milkTempC != null || c.foam ? 'Sữa' : null),
    c.milkMl != null ? `${c.milkMl} ml` : null,
    c.milkTempC != null ? `${c.milkTempC} °C` : null,
    c.foam ? `bọt ${c.foam.toLowerCase()}` : null].filter(Boolean)
  if (milk.length) lines.push(milk.join(' · '))
  if (c.waterMl != null) lines.push(`Nước thêm ${c.waterMl} ml`)
  if (c.iceG != null) lines.push(`Đá ${c.iceG} g`)
  if (c.sugarG != null) lines.push(`${c.sugar || 'Đường / syrup'} ${c.sugarG} g`)
  else if (c.sugar) lines.push(c.sugar)
  return lines
}
