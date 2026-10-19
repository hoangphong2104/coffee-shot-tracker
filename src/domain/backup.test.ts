import type { Cup } from '../data/types'
import { beansTD01, devicesTD01, NOW, S1, S2, S3, settingsTD01 } from '../test/td01'

const SEED_DEVICES = devicesTD01.filter((d) => d.builtin)
import { buildBackup, buildCsv, cleanCup, cleanShot, confirmText, csvCell, fileName, NOT_BACKUP, parseBackup, planImport, resultText } from './backup'

// MOD_005 — UT theo AC-0405 / AC-0406, RPT-001, RPT-002, INT-001, SEC-008 / 009.
const cup: Cup = { id: 'c1', shotId: 's1', cuppedAt: NOW, updatedAt: NOW, drink: 'Latte', iced: 'hot', milkType: 'Sữa tươi', milkMl: 180, rating: 8, tasteNotes: 'cam, "ngọt", hậu\nvị dài' }
const m1 = { ...SEED_DEVICES[0], id: 'm1', builtin: false, name: 'M1' }
const devices = [...SEED_DEVICES.map((d) => (d.id === 'gemilai-3007l' ? { ...d, gauge: { max: 16 } } : d)), m1]
const backup = buildBackup(
  { beans: beansTD01, devices, seed: SEED_DEVICES, shots: [S1, S2, S3], cups: [{ ...cup, photo: null }], videos: [], settings: settingsTD01() },
  new Date(NOW),
)
const none = () => ({ shots: new Set<string>(), beans: new Set<string>(), devices: new Set<string>(), cups: new Set<string>(), cupShots: new Set<string>() })

describe('xuất (UC_0405)', () => {
  it('RPT-001: chỉ thiết bị custom + phần đổi của máy có sẵn; tên file theo ngày', () => {
    expect(backup).toMatchObject({ app: 'shot-tracker', formatVersion: 1 })
    expect(backup.devices.map((d) => d.id)).toEqual(['m1'])
    expect(backup.builtinOverrides).toEqual([{ id: 'gemilai-3007l', gauge: { max: 16 } }])
    expect(fileName(new Date(2026, 9, 18), 'json')).toBe('shot-tracker-2026-10-18.json')
  })
  it('RPT-002: BOM, 32 cột, sắp tăng dần, ngoặc kép đúng, ratio 2 số lẻ', () => {
    const csv = buildCsv([S2, S1], [cup], beansTD01, devices)
    expect(csv.startsWith('\uFEFFid,datetime,method,bean')).toBe(true)
    const lines = csv.trim().split('\r\n')
    expect(lines[0].split(',')).toHaveLength(32)
    expect(lines[1].startsWith('s1,')).toBe(true) // S1 pha trước S2
    expect(lines[1]).toContain(',Turin DF64,Gemilai 3007L,18,36,2.00,14,')
    expect(lines[1]).toContain('"cam, ""ngọt"", hậu\nvị dài",yes,Latte,hot,Sữa tươi,180')
    expect(lines[2]).toContain(',no,')
    expect(csvCell(null)).toBe('')
  })
})

describe('nhập (UC_0406 / INT-001)', () => {
  it('nhận diện file: không phải JSON / không phải app / không có shots / phiên bản mới hơn → từ chối', () => {
    expect(parseBackup('xin chào').ok).toBe(false)
    expect(parseBackup('{"app":"khac","shots":[]}').ok).toBe(false)
    expect(parseBackup('{"app":"shot-tracker"}').ok).toBe(false)
    expect(parseBackup('{"app":"shot-tracker","formatVersion":2,"shots":[]}').ok).toBe(false)
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(true)
    expect(NOT_BACKUP).toBe('File này không phải bản sao lưu của Shot Tracker. Hãy chọn file .json đã xuất từ app')
  })
  it('khứ hồi: máy trống → thêm đủ; câu xác nhận và kết quả đúng UC', () => {
    const p = planImport(JSON.parse(JSON.stringify(backup)), none(), NOW)
    expect([p.shots.length, p.beans.length, p.devices.length, p.cups.length, p.dupShots]).toEqual([3, 3, 1, 1, 0])
    expect(p.shots[0]).toMatchObject(S1)
    expect(confirmText(p)).toBe('File có 3 shot, 3 hạt, 1 thiết bị custom. Sẽ thêm 3 shot mới, bỏ qua 0 đã có.')
    expect(resultText(p)).toBe('Đã thêm 3 shot, 3 hạt, 1 thiết bị. Bỏ qua 0 bản đã có')
  })
  it('gộp: bản đã có giữ nguyên; ly chỉ thêm khi shot chưa có ly', () => {
    const have = { shots: new Set(['s1', 's2']), beans: new Set(['eth']), devices: new Set(['m1']), cups: new Set<string>(), cupShots: new Set(['s1']) }
    const p = planImport(JSON.parse(JSON.stringify(backup)), have, NOW)
    expect(p.shots.map((s) => s.id)).toEqual(['s3'])
    expect(p.dupShots).toBe(2)
    expect(p.beans.map((b) => b.id)).toEqual(['col', 'cau'])
    expect(p.devices).toEqual([])
    expect(p.cups).toEqual([]) // s1 đã có ly
  })
  it('SEC-008 / 009: chữ giữ nguyên là chữ, số sai kiểu → rỗng, ảnh lạ bị bỏ, thiết bị nhập luôn là custom', () => {
    const s = cleanShot({ ...S1, notes: '<img src=x onerror=alert(1)>', dose: '18', grind: Infinity }, NOW)!
    expect(s.notes).toBe('<img src=x onerror=alert(1)>')
    expect([s.dose, s.grind]).toEqual([null, null])
    expect(cleanCup({ ...cup, photo: 'javascript:alert(1)' }, NOW)!.photo).toBeNull()
    expect(cleanCup({ ...cup, photo: 'data:image/svg+xml;base64,AAAA' }, NOW)!.photo).toBeNull()
    expect(cleanCup({ ...cup, photo: 'data:image/jpeg;base64,/9j/AAA=' }, NOW)!.photo).toBe('data:image/jpeg;base64,/9j/AAA=')
    expect(cleanCup({ ...cup, rating: 42 }, NOW)!.rating).toBeNull()
    const p = planImport({ shots: [], devices: [{ ...m1, id: 'x', builtin: true }] }, none(), NOW)
    expect(p.devices[0].builtin).toBe(false)
    expect(cleanShot({ id: 'z' }, NOW)).toBeNull() // thiếu ngày giờ pha
  })
})
