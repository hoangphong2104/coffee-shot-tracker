import type { ShotTrackerDB } from '../../data/db'
import { SEED_DEVICES } from '../../data/seed'
import { buildBackup, buildCsv, fileName, type CupFile, type ImportPlan } from '../../domain/backup'

// MOD_005 — phần đọc / ghi: gom dữ liệu, ảnh ly Blob ↔ data URL, ghi gộp, đưa file cho bảng chia sẻ.

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => fail(r.error)
    r.readAsDataURL(b)
  })
const dataUrlToBlob = (u: string) => {
  const [head, b64] = u.split(',')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) })
}

export async function exportJsonFile(db: ShotTrackerDB, now = new Date()): Promise<File> {
  const [beans, devices, shots, cups, videos, settings] = await Promise.all([
    db.beans.toArray(), db.devices.toArray(), db.shots.toArray(), db.cups.toArray(), db.videos.toArray(), db.settings.get('main'),
  ])
  const cupFiles: CupFile[] = await Promise.all(cups.map(async (c) => ({ ...c, photo: c.photo ? await blobToDataUrl(c.photo) : null })))
  const data = buildBackup({ beans, devices, seed: SEED_DEVICES, shots, cups: cupFiles, videos, settings: settings! }, now)
  return new File([JSON.stringify(data)], fileName(now, 'json'), { type: 'application/json' })
}

export async function exportCsvFile(db: ShotTrackerDB, now = new Date()): Promise<File> {
  const [beans, devices, shots, cups] = await Promise.all([db.beans.toArray(), db.devices.toArray(), db.shots.toArray(), db.cups.toArray()])
  return new File([buildCsv(shots, cups, beans, devices)], fileName(now, 'csv'), { type: 'text/csv;charset=utf-8' })
}

/** UC_0405 bước 5–6 — bảng chia sẻ (huỷ = không lỗi), không có thì tải xuống. Lỗi khác → ném ra. */
export async function shareFile(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e
    }
    return
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function existingIds(db: ShotTrackerDB) {
  const [shots, beans, devices, cups] = await Promise.all([
    db.shots.toCollection().primaryKeys(), db.beans.toCollection().primaryKeys(), db.devices.toCollection().primaryKeys(), db.cups.toArray(),
  ])
  return {
    shots: new Set(shots as string[]), beans: new Set(beans as string[]), devices: new Set(devices as string[]),
    cups: new Set(cups.map((c) => c.id)), cupShots: new Set(cups.map((c) => c.shotId)),
  }
}

/** INT-001 — một lần ghi: lỗi giữa chừng → không thêm gì. Không đụng video, cài đặt, máy có sẵn. */
export async function applyImport(db: ShotTrackerDB, p: ImportPlan) {
  const cups = p.cups.map((c) => ({ ...c, photo: c.photo ? dataUrlToBlob(c.photo) : null }))
  await db.transaction('rw', [db.beans, db.devices, db.shots, db.cups], async () => {
    await db.beans.bulkAdd(p.beans)
    await db.devices.bulkAdd(p.devices)
    await db.shots.bulkAdd(p.shots)
    await db.cups.bulkAdd(cups)
  })
}

/** CR-001 — dung lượng video đang dùng. */
export async function videoUsage(db: ShotTrackerDB) {
  const vs = await db.videos.toArray()
  return { count: vs.length, mb: Math.round(vs.reduce((s, v) => s + v.sizeBytes, 0) / 1048576) }
}
