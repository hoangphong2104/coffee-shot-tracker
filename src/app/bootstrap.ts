import type { ShotTrackerDB } from '../data/db'
import { DEFAULT_CURRENT, SEED_DEVICES, SEED_VERSION } from '../data/seed'
import type { Device, DeviceSlot, InitLogEntry, Settings } from '../data/types'

/**
 * MOD_006 / UC_0901 — job `khoi-tao-du-lieu`, chạy mỗi lần mở app trước khi vẽ SC_0001.
 * Mọi thay đổi trong một transaction: lỗi giữa chừng → không có dữ liệu dở dang.
 * Nhật ký chỉ ghi kết quả, phiên bản, số lượng — không ghi dữ liệu người dùng (SEC-006).
 */
export type InitResult = { state: 'ready'; result: InitLogEntry['result'] } | { state: 'error'; error: string }

const LOG_KEY = 'initLog'
const LOG_MAX = 20

export async function initApp(
  db: ShotTrackerDB,
  seed: { version: number; devices: Device[] } = { version: SEED_VERSION, devices: SEED_DEVICES },
  now: () => number = Date.now,
): Promise<InitResult> {
  try {
    await db.open()
    let entry: InitLogEntry = { at: now(), result: 'Không đổi' }

    await db.transaction('rw', db.devices, db.settings, db.meta, async () => {
      const settings = await db.settings.get('main')

      if (!settings) {
        await db.devices.bulkPut(seed.devices)
        const first: Settings = {
          id: 'main',
          current: { ...DEFAULT_CURRENT },
          defaultMethod: 'espresso',
          baristaDefault: '',
          theme: 'system',
          tracked: {},
          defaults: {},
          catalogVersion: seed.version,
          installHintHidden: false,
          updatedAt: now(),
        }
        await db.settings.put(first)
        entry = { at: now(), result: 'Lần đầu', toVersion: seed.version, added: seed.devices.length }
      } else if (settings.catalogVersion < seed.version) {
        entry = await updateCatalog(db, settings, seed, now)
      }

      await appendLog(db, entry)
    })

    // SEC-013 / PLAT-010 — xin lưu trữ lâu dài; bị từ chối không chặn.
    try {
      await navigator.storage?.persist?.()
    } catch {
      /* bỏ qua */
    }
    return { state: 'ready', result: entry.result }
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error'
    try {
      await appendLog(db, { at: now(), result: 'Lỗi', error: name })
    } catch {
      /* bộ nhớ không mở được — không ghi được nhật ký */
    }
    return { state: 'error', error: name }
  }
}

/** UC_0901 C 4 — giữ thang đồng hồ và lần căn người dùng đã đổi; máy bị bỏ khỏi danh mục → ẩn, không xoá. */
async function updateCatalog(
  db: ShotTrackerDB,
  settings: Settings,
  seed: { version: number; devices: Device[] },
  now: () => number,
): Promise<InitLogEntry> {
  let added = 0
  let updated = 0
  const seedIds = new Set(seed.devices.map((d) => d.id))

  for (const d of seed.devices) {
    const old = await db.devices.get(d.id)
    if (!old) {
      await db.devices.put(d)
      added++
      continue
    }
    const gauge = d.gauge
      ? { max: old.gauge?.max ?? d.gauge.max, ...(old.gauge?.lastCalibration ? { lastCalibration: old.gauge.lastCalibration } : {}) }
      : null
    await db.devices.put({ ...d, gauge, status: old.status })
    updated++
  }

  const builtins = (await db.devices.toArray()).filter((d) => d.builtin)
  for (const old of builtins) {
    if (!seedIds.has(old.id) && old.status !== 'hidden') await db.devices.update(old.id, { status: 'hidden' })
  }

  const current = { ...settings.current }
  for (const slot of Object.keys(current) as DeviceSlot[]) {
    const id = current[slot]
    if (!id) continue
    const dev = await db.devices.get(id)
    if (!dev || dev.status !== 'active') current[slot] = null
  }

  await db.settings.put({ ...settings, current, catalogVersion: seed.version, updatedAt: now() })
  return { at: now(), result: 'Cập nhật danh mục', fromVersion: settings.catalogVersion, toVersion: seed.version, added, updated }
}

async function appendLog(db: ShotTrackerDB, entry: InitLogEntry) {
  const row = await db.meta.get(LOG_KEY)
  const log = (Array.isArray(row?.value) ? (row!.value as InitLogEntry[]) : []).concat(entry).slice(-LOG_MAX)
  await db.meta.put({ key: LOG_KEY, value: log })
}
