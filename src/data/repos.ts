import Dexie from 'dexie'
import type { ShotTrackerDB } from './db'
import type { Bean, Cup, Method, Shot } from './types'

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
