import Dexie from 'dexie'
import type { ShotTrackerDB } from './db'
import type { Bean, Cup, Device, DeviceSlot, Method, Settings, Shot } from './types'

// MOD_004 — repository trên Dexie. Mọi ghi nhiều bảng nằm trong một transaction (cùng thành công / thất bại).

// Không đặt tên 'NotFoundError' — trùng tên DOMException, Dexie sẽ tự đổi thành lỗi của nó.
export class GoneError extends Error {
  name = 'GoneError'
}

export type SaveResult = { ok: true; videoSkipped?: 'cap' | 'quota' } | { ok: false; reason: 'gone' | 'error' }

/** UC_0103 bước 19–21; UC_0107 bước 7, 10–12. Video (bước 20 / 11) nối vào ở CODE-007. */
export async function saveShot(db: ShotTrackerDB, rec: Shot, mode: 'new' | 'edit'): Promise<SaveResult> {
  try {
    await db.transaction('rw', db.shots, async () => {
      if (mode === 'edit' && !(await db.shots.get(rec.id))) throw new GoneError() // "Shot này không còn"
      await db.shots.put(rec)
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof GoneError ? 'gone' : 'error' }
  }
}

/** UC_0108 bước 3–4 — xoá Shot + Ly + Video trong một transaction. */
export async function deleteShot(db: ShotTrackerDB, id: string): Promise<'deleted' | 'gone'> {
  return db.transaction('rw', [db.shots, db.cups, db.videos, db.videoBlobs], async () => {
    if (!(await db.shots.get(id))) return 'gone'
    await db.cups.where('shotId').equals(id).delete()
    const v = await db.videos.where('shotId').equals(id).first()
    if (v) {
      await db.videoBlobs.delete(v.id)
      await db.videos.delete(v.id)
    }
    await db.shots.delete(id)
    return 'deleted'
  })
}

/** UC_0114 bước 10–11, 13; UC_0115 bước 4, 6 — một shot một ly (Q-029 d). */
export async function upsertCupByShot(db: ShotTrackerDB, rec: Cup): Promise<'created' | 'updated'> {
  return db.transaction('rw', db.shots, db.cups, async () => {
    if (!(await db.shots.get(rec.shotId))) throw new GoneError()
    const existing = await db.cups.where('shotId').equals(rec.shotId).first()
    if (existing) {
      await db.cups.put({ ...rec, id: existing.id, cuppedAt: existing.cuppedAt })
      return 'updated'
    }
    await db.cups.add(rec)
    return 'created'
  })
}

export const cupByShot = (db: ShotTrackerDB, shotId: string) => db.cups.where('shotId').equals(shotId).first()

/** UC_0104 bước 1 — shot mới nhất cùng phương pháp. */
export const latestShotByMethod = (db: ShotTrackerDB, m: Method) =>
  db.shots.where('[method+brewedAt]').between([m, Dexie.minKey], [m, Dexie.maxKey]).last()

/** UC_0103 bước 4 — hạt Đang dùng, sắp theo lần dùng gần nhất (chưa có shot → ngày tạo). */
export async function activeBeansByRecentUse(db: ShotTrackerDB): Promise<Bean[]> {
  const beans = await db.beans.where('status').equals('active').toArray()
  const last = new Map<string, number>()
  await db.shots.each((s) => {
    if ((last.get(s.beanId) ?? 0) < s.brewedAt) last.set(s.beanId, s.brewedAt)
  })
  const key = (b: Bean) => last.get(b.id) ?? b.createdAt
  return beans.sort((a, b) => key(b) - key(a))
}

/** UC_0202 bước 4. */
export const addBean = (db: ShotTrackerDB, b: Bean) => db.beans.add(b)

/** UC_0203 bước 4 — kiểm hạt còn rồi ghi. */
export async function updateBean(db: ShotTrackerDB, rec: Bean): Promise<'ok' | 'gone'> {
  return db.transaction('rw', db.beans, async () => {
    if (!(await db.beans.get(rec.id))) return 'gone'
    await db.beans.put(rec)
    return 'ok'
  })
}

/** UC_0204 / UC_0205 — đã ở trạng thái đích → 'same' (vẽ lại, không báo lỗi). */
export async function setBeanStatus(db: ShotTrackerDB, id: string, status: Bean['status'], now: number): Promise<'ok' | 'same' | 'gone'> {
  return db.transaction('rw', db.beans, async () => {
    const b = await db.beans.get(id)
    if (!b) return 'gone'
    if (b.status === status) return 'same'
    await db.beans.update(id, { status, updatedAt: now })
    return 'ok'
  })
}

/** UC_0303 / UC_0306 bước 9–10. */
export const addDevice = (db: ShotTrackerDB, d: Device) => db.devices.add(d)

/** UC_0304 bước 2, 4–5 — thiết bị không còn hoặc không phải custom → 'gone'. */
export async function updateDevice(db: ShotTrackerDB, rec: Device): Promise<'ok' | 'gone'> {
  return db.transaction('rw', db.devices, async () => {
    const old = await db.devices.get(rec.id)
    if (!old || old.builtin) return 'gone'
    await db.devices.put(rec)
    return 'ok'
  })
}

/**
 * UC_0305 (ẩn) / UC_0307 (hiện lại) — chỉ thiết bị custom. Ẩn → bỏ khỏi mọi ô đang dùng (DO_005);
 * trả về `cleared` để chọn toast. Hiện lại không đổi DO_005.
 */
export async function setDeviceStatus(db: ShotTrackerDB, id: string, status: Device['status'], now: number): Promise<{ r: 'ok' | 'skip'; cleared: boolean }> {
  return db.transaction('rw', db.devices, db.settings, async () => {
    const d = await db.devices.get(id)
    if (!d || d.builtin || d.status === status) return { r: 'skip' as const, cleared: false }
    await db.devices.update(id, { status, updatedAt: now })
    let cleared = false
    if (status === 'hidden') {
      const st = (await db.settings.get('main'))!
      const current = { ...st.current }
      for (const k of Object.keys(current) as DeviceSlot[]) if (current[k] === id) { current[k] = null; cleared = true }
      if (cleared) await db.settings.put({ ...st, current, updatedAt: now })
    }
    return { r: 'ok' as const, cleared }
  })
}

/** UC_0302 bước 8 / UC_0401 bước 3 — thiết bị phải còn Hoạt động. */
export async function setCurrentDevice(db: ShotTrackerDB, slot: DeviceSlot, id: string | null, now: number): Promise<'ok' | 'gone'> {
  return db.transaction('rw', db.devices, db.settings, async () => {
    if (id) {
      const d = await db.devices.get(id)
      if (!d || d.status !== 'active') return 'gone'
    }
    const st = (await db.settings.get('main'))!
    await db.settings.put({ ...st, current: { ...st.current, [slot]: id }, updatedAt: now })
    return 'ok'
  })
}

/** UC_0302 bước 7 — sửa thang đồng hồ của máy có sẵn (giữ lần căn). */
export async function setGaugeMax(db: ShotTrackerDB, id: string, max: number, now: number) {
  await db.transaction('rw', db.devices, async () => {
    const d = await db.devices.get(id)
    if (!d?.gauge) return
    await db.devices.update(id, { gauge: { ...d.gauge, max }, updatedAt: now })
  })
}

/** UC_0401..UC_0404 — ghi một phần cài đặt; [Ngày giờ sửa cuối] = lúc lưu. */
export async function updateSettings(db: ShotTrackerDB, patch: Partial<Omit<Settings, 'id'>>, now: number) {
  await db.transaction('rw', db.settings, async () => {
    const st = (await db.settings.get('main'))!
    await db.settings.put({ ...st, ...patch, updatedAt: now })
  })
}
