import type { Bean, Settings } from '../data/types'

// UC_0202 — thêm hạt cà phê (dùng cả dạng sheet trong SC_0102).

export const ROASTS = ['Light', 'Medium', 'Dark']
export const PROCESSES = ['Washed', 'Natural', 'Honey']

export interface BeanForm {
  name: string
  roaster: string
  origin: string
  roastLevel: string | null
  process: string | null
  roastDate: string // yyyy-MM-dd hoặc ''
}
export const emptyBeanForm = (): BeanForm => ({ name: '', roaster: '', origin: '', roastLevel: null, process: null, roastDate: '' })

/** DO_006 — khoá theo dõi của từng trường hạt. */
export const BEAN_TRACKED = { roaster: 'beanRoaster', origin: 'beanOrigin', roastLevel: 'beanRoastLevel', process: 'beanProcess', roastDate: 'beanRoastDate' } as const
export const beanFieldOn = (tracked: Settings['tracked'], k: keyof typeof BEAN_TRACKED) => tracked[BEAN_TRACKED[k]] !== false

/** UC_0202 bước 3 — gom lỗi; trùng tên không chặn (Q-030). */
export function validateBean(f: BeanForm, today: string): Partial<Record<'name' | 'roastDate', string>> {
  const e: Partial<Record<'name' | 'roastDate', string>> = {}
  if (!f.name.trim()) e.name = 'Nhập tên hạt'
  if (f.roastDate && f.roastDate > today) e.roastDate = 'Ngày rang không được sau hôm nay'
  return e
}

/** UC_0202 bước 4 — trường đang tắt → rỗng. */
export function toBeanRecord(f: BeanForm, tracked: Settings['tracked'], now: number, newId: () => string): Bean {
  const on = (k: keyof typeof BEAN_TRACKED) => beanFieldOn(tracked, k)
  return {
    id: newId(),
    name: f.name.trim(),
    roaster: on('roaster') ? f.roaster.trim() : '',
    origin: on('origin') ? f.origin.trim() : '',
    roastLevel: on('roastLevel') ? f.roastLevel : null,
    process: on('process') ? f.process : null,
    roastDate: on('roastDate') && f.roastDate ? f.roastDate : null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

export const beanFormFrom = (b: Bean): BeanForm => ({
  name: b.name, roaster: b.roaster ?? '', origin: b.origin ?? '', roastLevel: b.roastLevel ?? null, process: b.process ?? null, roastDate: b.roastDate ?? '',
})

/** UC_0203 bước 4 — giữ id, trạng thái, ngày tạo; trường đang tắt giữ giá trị cũ (Q-030). */
export function applyBeanEdit(b: Bean, f: BeanForm, tracked: Settings['tracked'], now: number): Bean {
  const on = (k: keyof typeof BEAN_TRACKED) => beanFieldOn(tracked, k)
  return {
    ...b,
    name: f.name.trim(),
    roaster: on('roaster') ? f.roaster.trim() : b.roaster,
    origin: on('origin') ? f.origin.trim() : b.origin,
    roastLevel: on('roastLevel') ? f.roastLevel : b.roastLevel,
    process: on('process') ? f.process : b.process,
    roastDate: on('roastDate') ? f.roastDate || null : b.roastDate,
    updatedAt: now,
  }
}

/** UC_0201 bước 4 / UC_0203 bước 2 — số shot và rating cao nhất của ly. */
export function beanStats(beanId: string, shots: { id: string; beanId: string }[], cups: { shotId: string; rating?: number | null }[]) {
  const ids = new Set(shots.filter((s) => s.beanId === beanId).map((s) => s.id))
  const ratings = cups.filter((c) => ids.has(c.shotId) && c.rating != null).map((c) => c.rating!)
  return { count: ids.size, best: ratings.length ? Math.max(...ratings) : null }
}
