import { ShotTrackerDB } from '../../data/db'
import { initApp } from '../../app/bootstrap'
import { confirmText, parseBackup, planImport, resultText } from '../../domain/backup'
import { beansTD01, S1, S2, S3, settingsTD01 } from '../../test/td01'
import { applyImport, existingIds, exportCsvFile, exportJsonFile } from './io'

// AC-0405-01 / 02, AC-0406-01 / 02 / 09 — qua IndexedDB (fake-indexeddb).
// fake-indexeddb + jsdom không giữ được Blob (trả về object rỗng) nên ảnh ly được đưa vào ở bước đọc
// và kiểm ở lời gọi ghi; trên trình duyệt thật đã kiểm tay (implementation-trace CODE-006).
let n = 0
const fresh = async () => {
  const db = new ShotTrackerDB(`io-${++n}`)
  await initApp(db)
  await db.settings.put(settingsTD01())
  return db
}
const photo = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })
const readFile = (f: File) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(f) })

async function oldPhone() {
  const db = await fresh()
  await db.beans.bulkAdd(beansTD01)
  await db.devices.add({ ...(await db.devices.get('df64'))!, id: 'm1', builtin: false, name: 'M1' })
  await db.shots.bulkAdd([{ ...S1, pressureCurve: [[1, 2.5, 0.9, 'a'], [2, 9, 1, 'm']], marks: { start: 1, end: 29 } }, S2, S3])
  const c1 = { id: 'c1', shotId: 's1', cuppedAt: 1, updatedAt: 1, drink: 'Latte', iced: 'hot' as const, rating: 8 }
  await db.cups.add(c1)
  const toArray = db.cups.toArray.bind(db.cups)
  vi.spyOn(db.cups, 'toArray').mockImplementation((async () => (await toArray()).map((c) => (c.id === 'c1' ? { ...c, photo } : c))) as never)
  return db
}

it('AC-0405-01 / AC-0406-09: xuất JSON từ máy cũ → nhập vào máy mới → đủ hạt, máy custom, shot + đường áp suất, ly + ảnh', async () => {
  const a = await oldPhone()
  const file = await exportJsonFile(a, new Date(2026, 9, 18))
  expect(file.name).toBe('shot-tracker-2026-10-18.json')
  const parsed = parseBackup(await readFile(file))
  expect(parsed.ok).toBe(true)

  const b = await fresh()
  const plan = planImport((parsed as { data: Record<string, unknown> }).data, await existingIds(b), Date.now())
  const add = vi.spyOn(b.cups, 'bulkAdd')
  await applyImport(b, plan)
  expect([await b.shots.count(), await b.beans.count(), await b.devices.filter((d) => !d.builtin).count(), await b.cups.count()]).toEqual([3, 3, 1, 1])
  expect((await b.shots.get('s1'))!.pressureCurve).toEqual([[1, 2.5, 0.9, 'a'], [2, 9, 1, 'm']])
  const cup = (add.mock.calls[0][0] as unknown as { id: string; photo: Blob }[]).find((c) => c.id === 'c1')!
  expect(cup.photo).toBeInstanceOf(Blob)
  expect(cup.photo!.type).toBe('image/png')
  expect(cup.photo!.size).toBe(4)
  await Promise.all([a.delete(), b.delete()])
})

it('AC-0406-01 / 02: gộp — thêm bản mới, bỏ qua trùng, không ghi đè shot trên máy', async () => {
  const a = await oldPhone()
  await a.shots.update('s1', { grind: 20 })
  for (let i = 0; i < 7; i++) await a.shots.add({ ...S2, id: `new-${i}` })
  const data = (parseBackup(await readFile(await exportJsonFile(a))) as { data: Record<string, unknown> }).data

  const b = await fresh()
  await b.beans.add(beansTD01[0])
  await b.shots.bulkAdd([S1, S2, S3]) // 3 shot trùng Định danh
  const plan = planImport(data, await existingIds(b), Date.now())
  expect(confirmText(plan)).toBe('File có 10 shot, 3 hạt, 1 thiết bị custom. Sẽ thêm 7 shot mới, bỏ qua 3 đã có.')
  await applyImport(b, plan)
  expect(resultText(plan)).toBe('Đã thêm 7 shot, 2 hạt, 1 thiết bị. Bỏ qua 3 bản đã có')
  expect((await b.shots.get('s1'))!.grind).toBe(14) // không ghi đè
  expect(await b.shots.count()).toBe(10)
  await Promise.all([a.delete(), b.delete()])
})

it('INT-001: lỗi giữa chừng → không thêm gì', async () => {
  const a = await oldPhone()
  const data = (parseBackup(await readFile(await exportJsonFile(a))) as { data: Record<string, unknown> }).data
  const b = await fresh()
  const plan = planImport(data, await existingIds(b), Date.now())
  vi.spyOn(b.cups, 'bulkAdd').mockRejectedValueOnce(new Error('QuotaExceededError'))
  await expect(applyImport(b, plan)).rejects.toThrow()
  expect([await b.shots.count(), await b.beans.count()]).toEqual([0, 0])
  await Promise.all([a.delete(), b.delete()])
})

it('AC-0405-02: CSV 32 cột, BOM, sắp cũ → mới', async () => {
  const a = await oldPhone()
  const f = await exportCsvFile(a, new Date(2026, 9, 18))
  expect(f.name).toBe('shot-tracker-2026-10-18.csv')
  const bytes = new Uint8Array(await new Promise<ArrayBuffer>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as ArrayBuffer); r.readAsArrayBuffer(f) }))
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const lines = (await readFile(f)).replace(/^\uFEFF/, '').trim().split('\r\n')
  expect(lines[0].split(',')).toHaveLength(32)
  expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual(['s3', 's1', 's2'])
  await a.delete()
})
