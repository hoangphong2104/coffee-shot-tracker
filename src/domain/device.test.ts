import { devicesTD01, settingsTD01 } from '../test/td01'
import { applyBeanEdit, beanFormFrom, beanStats } from './bean'
import {
  changeKind, deviceGroups, formFromDevice, newDeviceForm, parseGaugeMax, rangeLabel, slotFor, toDeviceRecord, toggleGauge, toggleRange, validateDevice,
} from './device'

// UT theo AC-0301 / 0302 / 0303 / 0304 / 0306, UC_0201, UC_0203.
const st = settingsTD01()
const id = () => 'new'

describe('danh sách thiết bị (UC_0301)', () => {
  it('máy xay: đang dùng lên đầu; tìm không dấu theo hãng + tên', () => {
    const g = deviceGroups(devicesTD01, 'grinder', { q: '', kind: '', hidden: false }, st)
    expect(g).toHaveLength(1)
    expect(g[0].items[0].id).toBe('df64')
    expect(deviceGroups(devicesTD01, 'grinder', { q: 'comandante c40', kind: '', hidden: false }, st)[0].items.map((d) => d.id)).toEqual(['comandante-c40'])
    expect(deviceGroups(devicesTD01, 'brewer', { q: 'zzz', kind: '', hidden: false }, st)).toEqual([])
  })
  it('máy pha: nhóm theo loại đúng thứ tự; ẩn chỉ hiện khi bật công tắc', () => {
    const devs = devicesTD01.map((d) => (d.id === 'hario-v60-02' ? { ...d, status: 'hidden' as const } : d))
    const kinds = deviceGroups(devs, 'brewer', { q: '', kind: '', hidden: false }, st).map((g) => g.kind)
    expect(kinds).toEqual(['espresso', 'pourover', 'aeropress', 'moka', 'frenchpress'])
    const pour = (h: boolean) => deviceGroups(devs, 'brewer', { q: '', kind: 'pourover', hidden: h }, st)[0].items.map((d) => d.id)
    expect(pour(false)).not.toContain('hario-v60-02')
    expect(pour(true)).toContain('hario-v60-02')
  })
})

describe('form thiết bị (UC_0303 / 0304 / 0306)', () => {
  it('mặc định: Máy xay, cả 5 phương pháp, vạch dial, Grind 0–100', () => {
    const f = newDeviceForm('Kinu')
    expect(f).toMatchObject({ kind: 'grinder', name: 'Kinu', grindUnit: 'vạch dial', ranges: { grind: ['0', '100'], grindTime: ['0', '120'], retention: ['0', '5'] } })
    expect(f.methods).toHaveLength(5)
  })
  it('đổi loại → khoảng mặc định + phương pháp của loại', () => {
    const f = changeKind(newDeviceForm(), 'frenchpress')
    expect(f.methods).toEqual(['frenchpress'])
    expect(f.ranges).toEqual({ dose: ['5', '80'], temp: ['70', '100'], time: ['60', '1200'], yield: ['100', '1500'] })
    expect(changeKind(f, 'other', 'Phin').methods).toEqual([])
    expect(rangeLabel('time', 'frenchpress')).toBe('Thời gian ủ')
    expect(rangeLabel('pre', 'other')).toBe('Bloom')
  })
  it('kiểm tra: tên, phương pháp, khoảng thiếu, Từ > Đến', () => {
    const f = { ...changeKind(newDeviceForm(''), 'other'), ranges: { dose: ['', '20'] as [string, string], temp: ['100', '60'] as [string, string] } }
    expect(validateDevice(f)).toEqual({
      name: 'Nhập tên thiết bị',
      methods: 'Chọn ít nhất một phương pháp',
      r_dose: 'Nhập đủ khoảng cho Dose',
      r_temp: "Giá trị 'Từ' phải nhỏ hơn hoặc bằng 'Đến'",
    })
  })
  it('tắt "Theo dõi" → không có dòng khoảng; bật lại → khoảng mặc định', () => {
    let f = toggleRange(newDeviceForm('A'), 'retention', false)
    expect(toDeviceRecord(f, 1, id).ranges).toEqual({ grind: [0, 100], grindTime: [0, 120] })
    f = toggleRange(f, 'retention', true)
    expect(f.ranges.retention).toEqual(['0', '5'])
  })
  it('đồng hồ áp: bật → thang = cận trên Áp suất; thang sai → giữ giá trị trước', () => {
    let f = toggleGauge({ ...changeKind(newDeviceForm('E'), 'espresso'), ranges: { pressure: ['0', '12'] } }, true)
    expect(f.gaugeMax).toBe('12')
    expect(toDeviceRecord(f, 1, id).gauge).toEqual({ max: 12 })
    f = { ...f, gaugeMax: '45' }
    expect(toDeviceRecord(f, 1, id).gauge).toEqual({ max: 15 })
  })
  it('nhân bản: "{Tên} (của tôi)", custom, clonedFrom, không chép lần căn', () => {
    const g = { ...devicesTD01.find((d) => d.id === 'gemilai-3007l')!, gauge: { max: 16, lastCalibration: { c: [1, 1], z: [0, 0], m: [2, 2] } as never } }
    const rec = toDeviceRecord(formFromDevice(g, true), 5, id)
    expect(rec).toMatchObject({ id: 'new', name: '3007L (của tôi)', builtin: false, clonedFrom: 'gemilai-3007l', status: 'active', gauge: { max: 16 } })
    expect(rec.gauge).not.toHaveProperty('lastCalibration')
  })
  it('sửa: giữ id, loại, trạng thái, ngày tạo, lần căn', () => {
    const cal = { c: [1, 1], z: [0, 0], m: [2, 2] } as never
    const m2 = { ...devicesTD01.find((d) => d.id === 'm1')!, kind: 'espresso' as const, status: 'hidden' as const, createdAt: 3, gauge: { max: 15, lastCalibration: cal } }
    const rec = toDeviceRecord({ ...formFromDevice(m2), name: 'M2', kind: 'grinder' }, 9, id, m2)
    expect(rec).toMatchObject({ id: 'm1', kind: 'espresso', status: 'hidden', createdAt: 3, updatedAt: 9, name: 'M2', gauge: { max: 15, lastCalibration: cal } })
  })
})

describe('đang dùng / thang (UC_0401 bước 4, UC_0302 bước 7)', () => {
  it('slot: máy xay; dụng cụ = phương pháp đầu tiên; Khác không có → Pour Over', () => {
    expect(slotFor({ kind: 'grinder', methods: ['espresso'] })).toBe('grinder')
    expect(slotFor({ kind: 'aeropress', methods: ['aeropress'] })).toBe('aeropress')
    expect(slotFor({ kind: 'other', methods: [] })).toBe('pourover')
  })
  it('thang đồng hồ (0, 30]', () => {
    expect([parseGaugeMax('16'), parseGaugeMax('0'), parseGaugeMax('31'), parseGaugeMax('abc'), parseGaugeMax('30')]).toEqual([16, null, null, null, 30])
  })
})

describe('hạt (UC_0201 / UC_0203)', () => {
  const b = { id: 'eth', name: 'Eth', roaster: 'Rang Mộc', origin: 'Yirga', roastLevel: 'Light', status: 'out' as const, createdAt: 1, updatedAt: 1 }
  it('sửa: trường đang tắt giữ giá trị cũ; giữ trạng thái, ngày tạo', () => {
    const r = applyBeanEdit(b, { ...beanFormFrom(b), name: 'Eth 2', roaster: '', origin: '' }, { beanRoaster: false }, 9)
    expect(r).toMatchObject({ name: 'Eth 2', roaster: 'Rang Mộc', origin: '', status: 'out', createdAt: 1, updatedAt: 9 })
  })
  it('thống kê: số shot + rating cao nhất', () => {
    expect(beanStats('eth', [{ id: 's1', beanId: 'eth' }, { id: 's2', beanId: 'eth' }, { id: 's3', beanId: 'x' }], [{ shotId: 's1', rating: 7 }, { shotId: 's2', rating: null }, { shotId: 's3', rating: 10 }]))
      .toEqual({ count: 2, best: 7 })
  })
})
