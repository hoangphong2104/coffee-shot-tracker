import { ShotTrackerDB } from './db'
import { activeBeansByRecentUse, deleteShot, latestShotByMethod, saveShot, upsertCupByShot, GoneError, setBeanStatus, setDeviceStatus, setCurrentDevice, updateDevice, updateBean, setGaugeMax } from './repos'
import { SEED_DEVICES } from './seed'
import { settingsTD01 } from '../test/td01'
import { beansTD01, S1, S2, S3 } from '../test/td01'
import type { Cup } from './types'

// MOD_004 — UT theo AC-0103-17, AC-0107-06, AC-0108-01 / 04, AC-0114-09 / 10.
let n = 0
let db: ShotTrackerDB
beforeEach(async () => {
  db = new ShotTrackerDB(`repo-${++n}`)
  await db.beans.bulkAdd(beansTD01)
  await db.shots.bulkAdd([S1, S2, S3])
})
afterEach(() => db.delete())

const cup = (shotId: string, over: Partial<Cup> = {}): Cup => ({ id: `c-${shotId}`, shotId, cuppedAt: 1, updatedAt: 1, drink: 'Latte', iced: 'hot', ...over })

it('saveShot sửa shot đã bị xoá → gone (AC-0107-06)', async () => {
  await db.shots.delete('s1')
  expect(await saveShot(db, { ...S1, grind: 15 }, 'edit')).toEqual({ ok: false, reason: 'gone' })
  expect(await db.shots.get('s1')).toBeUndefined()
})

it('saveShot bộ nhớ từ chối → error, không có shot (AC-0103-17)', async () => {
  vi.spyOn(db.shots, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'))
  expect(await saveShot(db, { ...S1, id: 'x' }, 'new')).toEqual({ ok: false, reason: 'error' })
  expect(await db.shots.get('x')).toBeUndefined()
})

it('deleteShot xoá shot + ly + video cùng lúc (AC-0108-01)', async () => {
  await db.cups.add(cup('s1'))
  await db.videos.add({ id: 'v1', shotId: 's1', durationS: 30, sizeBytes: 10, mime: 'video/mp4', recordedAt: 1 })
  await db.videoBlobs.add({ videoId: 'v1', blob: new Blob(['x']) })
  expect(await deleteShot(db, 's1')).toBe('deleted')
  expect([await db.shots.get('s1'), await db.cups.get('c-s1'), await db.videos.get('v1'), await db.videoBlobs.get('v1')]).toEqual([undefined, undefined, undefined, undefined])
  expect(await db.shots.count()).toBe(2)
})

it('deleteShot shot đã bị xoá → gone (AC-0108-04)', async () => {
  await db.shots.delete('s1')
  expect(await deleteShot(db, 's1')).toBe('gone')
})

it('upsertCupByShot tạo ly; đã có ly thì cập nhật, không tạo ly thứ hai (AC-0114-09)', async () => {
  expect(await upsertCupByShot(db, cup('s2', { id: 'a' }))).toBe('created')
  expect(await upsertCupByShot(db, cup('s2', { id: 'b', rating: 9, cuppedAt: 50 }))).toBe('updated')
  const all = await db.cups.where('shotId').equals('s2').toArray()
  expect(all).toHaveLength(1)
  expect(all[0]).toMatchObject({ id: 'a', rating: 9, cuppedAt: 1 })
})

it('upsertCupByShot shot đã bị xoá → GoneError (AC-0114-10)', async () => {
  await expect(upsertCupByShot(db, cup('zzz'))).rejects.toBeInstanceOf(GoneError)
  expect(await db.cups.count()).toBe(0)
})

it('latestShotByMethod: shot Espresso mới nhất; không có Aeropress (AC-0104-01 / 03)', async () => {
  expect((await latestShotByMethod(db, 'espresso'))?.id).toBe('s2')
  expect(await latestShotByMethod(db, 'aeropress')).toBeUndefined()
})

it('activeBeansByRecentUse: chỉ hạt Đang dùng, mới dùng trước (UC_0103 bước 4)', async () => {
  expect((await activeBeansByRecentUse(db)).map((b) => b.id)).toEqual(['col', 'eth'])
})

describe('hạt / thiết bị (UC_0203..0205, UC_0302, UC_0304, UC_0305, UC_0307)', () => {
  beforeEach(async () => {
    await db.settings.put(settingsTD01())
    await db.devices.bulkAdd([...SEED_DEVICES, { ...SEED_DEVICES[0], id: 'm1', builtin: false, name: 'M1' }])
  })
  it('UC_0204 / 0205: chuyển trạng thái; đã ở trạng thái đích → same; không còn → gone', async () => {
    expect(await setBeanStatus(db, 'eth', 'out', 5)).toBe('ok')
    expect((await db.beans.get('eth'))).toMatchObject({ status: 'out', updatedAt: 5 })
    expect(await setBeanStatus(db, 'eth', 'out', 6)).toBe('same')
    expect(await setBeanStatus(db, 'zzz', 'active', 6)).toBe('gone')
    expect(await updateBean(db, { ...beansTD01[0], id: 'zzz' })).toBe('gone')
  })
  it('UC_0305: ẩn custom đang dùng → bỏ khỏi ô đang dùng; UC_0307 hiện lại không đổi DO_005', async () => {
    await setCurrentDevice(db, 'grinder', 'm1', 1)
    expect(await setDeviceStatus(db, 'm1', 'hidden', 2)).toEqual({ r: 'ok', cleared: true })
    expect((await db.settings.get('main'))!.current.grinder).toBeNull()
    expect(await setDeviceStatus(db, 'm1', 'active', 3)).toEqual({ r: 'ok', cleared: false })
    expect((await db.settings.get('main'))!.current.grinder).toBeNull()
    expect(await setDeviceStatus(db, 'df64', 'hidden', 3)).toEqual({ r: 'skip', cleared: false }) // máy có sẵn không ẩn được
  })
  it('UC_0302 bước 8: không đặt được thiết bị đã ẩn; UC_0304: máy có sẵn không sửa được', async () => {
    await setDeviceStatus(db, 'm1', 'hidden', 2)
    expect(await setCurrentDevice(db, 'grinder', 'm1', 3)).toBe('gone')
    expect(await updateDevice(db, { ...SEED_DEVICES[0], name: 'X' })).toBe('gone')
  })
  it('UC_0302 bước 7: sửa thang giữ lần căn', async () => {
    const cal = { c: [1, 1], z: [0, 0], m: [2, 2] } as never
    await db.devices.update('gemilai-3007l', { gauge: { max: 15, lastCalibration: cal } })
    await setGaugeMax(db, 'gemilai-3007l', 16, 4)
    expect((await db.devices.get('gemilai-3007l'))!.gauge).toEqual({ max: 16, lastCalibration: cal })
  })
})
