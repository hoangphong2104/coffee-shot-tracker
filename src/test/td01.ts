import { SEED_DEVICES, DEFAULT_CURRENT } from '../data/seed'
import type { Bean, Device, Settings, Shot } from '../data/types'

// Dữ liệu kiểm thử chung TD-01 (acceptance-criteria-index-v1) — dữ liệu giả (SEC-011).

const T0 = new Date(2026, 9, 18, 7, 0).getTime()
export const NOW = T0

export const settingsTD01 = (over: Partial<Settings> = {}): Settings => ({
  id: 'main',
  current: { ...DEFAULT_CURRENT, pourover: 'hario-v60-02' },
  defaultMethod: 'espresso',
  baristaDefault: '',
  theme: 'system',
  tracked: {},
  defaults: { espresso: { dose: 18, yield: 36, grind: 14, temp: 94, pressure: 9, pre: 3 }, pourover: { dose: 15, yield: 250, grind: 58 } },
  catalogVersion: 1,
  installHintHidden: false,
  updatedAt: T0,
  ...over,
})

const m1: Device = { ...SEED_DEVICES.find((d) => d.id === 'df64')!, id: 'm1', brand: 'Tự làm', name: 'M1', builtin: false, ranges: { grind: [0, 90] } }
export const devicesTD01: Device[] = [...SEED_DEVICES, m1]

export const beansTD01: Bean[] = [
  { id: 'eth', name: 'Ethiopia Yirgacheffe', roaster: 'Rang Mộc', roastLevel: 'Light', status: 'active', roastDate: '2026-10-09', createdAt: T0 - 9e8, updatedAt: T0 - 9e8 },
  { id: 'col', name: 'Colombia Huila', status: 'active', createdAt: T0 - 8e8, updatedAt: T0 - 8e8 },
  { id: 'cau', name: 'Cầu Đất', status: 'out', createdAt: T0 - 7e8, updatedAt: T0 - 7e8 },
]

const shot = (id: string, over: Partial<Shot>): Shot => ({
  id,
  brewedAt: T0,
  method: 'espresso',
  methodOther: null,
  beanId: 'eth',
  grinderId: 'df64',
  brewerId: 'gemilai-3007l',
  dose: null, grind: null, grindTime: null, retention: null, temp: null, pressure: null, pre: null, time: null, yield: null,
  barista: '',
  notes: '',
  createdAt: T0,
  updatedAt: T0,
  ...over,
})
export const S1 = shot('s1', { brewedAt: T0 - 3 * 3.6e6, dose: 18, yield: 36, grind: 14, time: 29, pressure: 9, pre: 3, createdAt: T0 - 3 * 3.6e6, updatedAt: T0 - 3.6e6 })
export const S2 = shot('s2', { brewedAt: T0 - 3.6e6, beanId: 'col', dose: 18.5, yield: 37, grind: 13, time: 30, notes: 'ngon' })
export const S3 = shot('s3', { brewedAt: T0 - 5 * 3.6e6, grinderId: 'm1', grind: 60 })
export const shotsTD01 = [S1, S2, S3]
