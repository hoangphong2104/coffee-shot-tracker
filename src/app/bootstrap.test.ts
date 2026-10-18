import { ShotTrackerDB } from '../data/db'
import { SEED_DEVICES } from '../data/seed'
import type { Device, InitLogEntry } from '../data/types'
import { initApp } from './bootstrap'

// UC_0901 — AC-0901-01..06 (nạp lần đầu, mở lại, cập nhật danh mục, lỗi bộ nhớ).

let n = 0
let db: ShotTrackerDB
beforeEach(() => {
  db = new ShotTrackerDB(`test-${++n}`)
})
afterEach(async () => {
  await db.delete()
})

const log = async () => ((await db.meta.get('initLog'))?.value ?? []) as InitLogEntry[]

describe('initApp', () => {
  it('lần đầu: nạp 49 thiết bị dựng sẵn và cài đặt mặc định', async () => {
    const r = await initApp(db)
    expect(r).toEqual({ state: 'ready', result: 'Lần đầu' })
    expect(await db.devices.count()).toBe(49)
    const kinds = await db.devices.toArray()
    expect(kinds.filter((d) => d.kind === 'grinder')).toHaveLength(16)
    expect(kinds.filter((d) => d.kind === 'espresso')).toHaveLength(17)
    expect(kinds.every((d) => d.status === 'active' && d.builtin)).toBe(true)
    const s = await db.settings.get('main')
    expect(s).toMatchObject({ theme: 'system', defaultMethod: 'espresso', catalogVersion: 1, tracked: {}, defaults: {} })
    expect(s!.current.grinder).toBe('df64')
    expect(s!.current.espresso).toBe('gemilai-3007l')
    expect((await log())[0]).toMatchObject({ result: 'Lần đầu', added: 49, toVersion: 1 })
  })

  it('mở lại cùng phiên bản danh mục: không đổi dữ liệu', async () => {
    await initApp(db)
    await db.devices.update('df64', { name: 'Đổi thử' })
    const r = await initApp(db)
    expect(r).toEqual({ state: 'ready', result: 'Không đổi' })
    expect((await db.devices.get('df64'))!.name).toBe('Đổi thử')
    expect(await log()).toHaveLength(2)
  })

  it('danh mục mới: giữ thang đồng hồ người dùng đã đổi, ẩn máy bị bỏ, bỏ chọn máy đã ẩn', async () => {
    await initApp(db)
    const cal = { c: [1, 1] as [number, number], z: [0, 0] as [number, number], m: [2, 2] as [number, number] }
    await db.devices.update('gemilai-3007l', { gauge: { max: 12, lastCalibration: cal } })

    const next = SEED_DEVICES.filter((d) => d.id !== 'df64').map((d) => (d.id === 'gemilai-3007l' ? { ...d, name: 'Tên mới' } : d))
    const added: Device = { ...SEED_DEVICES[0], id: 'may-moi', name: 'Máy mới' }
    const r = await initApp(db, { version: 2, devices: [...next, added] })

    expect(r).toEqual({ state: 'ready', result: 'Cập nhật danh mục' })
    const g = (await db.devices.get('gemilai-3007l'))!
    expect(g.name).toBe('Tên mới')
    expect(g.gauge).toEqual({ max: 12, lastCalibration: cal })
    expect((await db.devices.get('df64'))!.status).toBe('hidden')
    expect(await db.devices.get('may-moi')).toBeDefined()
    const s = (await db.settings.get('main'))!
    expect(s.catalogVersion).toBe(2)
    expect(s.current.grinder).toBeNull()
    expect(s.current.espresso).toBe('gemilai-3007l')
    expect((await log()).at(-1)).toMatchObject({ fromVersion: 1, toVersion: 2, added: 1, updated: 48 })
  })

  it('không đụng thiết bị custom của người dùng khi cập nhật danh mục', async () => {
    await initApp(db)
    const custom: Device = { ...SEED_DEVICES[0], id: 'custom-1', builtin: false, name: 'Của tôi' }
    await db.devices.put(custom)
    await initApp(db, { version: 2, devices: SEED_DEVICES })
    expect(await db.devices.get('custom-1')).toEqual(custom)
  })

  it('nhật ký giữ tối đa 20 lần, không chứa dữ liệu người dùng', async () => {
    for (let i = 0; i < 23; i++) await initApp(db)
    const l = await log()
    expect(l).toHaveLength(20)
    expect(Object.keys(l[0]).sort()).toEqual(['at', 'result'])
  })

  it('bộ nhớ không mở được → trạng thái lỗi', async () => {
    vi.spyOn(db, 'open').mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'InvalidStateError' }))
    const r = await initApp(db)
    expect(r).toEqual({ state: 'error', error: 'InvalidStateError' })
  })

  it('lỗi giữa transaction → không để lại dữ liệu dở dang', async () => {
    vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'))
    const r = await initApp(db)
    expect(r.state).toBe('error')
    expect(await db.devices.count()).toBe(0)
    expect(await db.settings.get('main')).toBeUndefined()
  })
})

describe('schema', () => {
  it('&shotId: một shot chỉ có tối đa một ly (BR-12)', async () => {
    await db.cups.add({ id: 'c1', shotId: 's1', cuppedAt: 1 } as never)
    await expect(db.cups.add({ id: 'c2', shotId: 's1', cuppedAt: 2 } as never)).rejects.toThrow()
  })

  it('&shotId: một shot chỉ có tối đa một video (BR-13)', async () => {
    await db.videos.add({ id: 'v1', shotId: 's1' } as never)
    await expect(db.videos.add({ id: 'v2', shotId: 's1' } as never)).rejects.toThrow()
  })
})
