import type { Device } from '../types'
import raw from './devices.json'

/**
 * Danh mục thiết bị có sẵn (DO_003 seed v1 — 49 thiết bị), xuất từ prototype v2.1 đã duyệt.
 * Tăng SEED_VERSION mỗi khi đổi danh mục → UC_0901 cập nhật máy có sẵn khi mở app.
 */
export const SEED_VERSION = 1

type RawDevice = Omit<Device, 'builtin' | 'status'>

export const SEED_DEVICES: Device[] = (raw as RawDevice[]).map((d) => ({
  ...d,
  builtin: true,
  status: 'active' as const,
}))

export const DEFAULT_CURRENT = {
  grinder: 'df64',
  espresso: 'gemilai-3007l',
  pourover: null,
  aeropress: null,
  moka: null,
  frenchpress: null,
} as const
