import { devicesTD01, NOW, S1, S2, S3, settingsTD01 } from '../test/td01'
import {
  applyReuse, changeMethod, droppedBanner, editShotForm, fmtRatio, newShotForm, paramLabel, parseNumber, ratio, ratioStyle,
  stepValue, summaryToast, toShotRecord, validateShot, visibleParams, wheelSides,
} from './shot'

// MOD_001 — UT theo AC-0103 / 0104 / 0105 / 0107.
const st = settingsTD01()
const id = () => 'new-id'

describe('newShotForm (UC_0103 bước 1–8)', () => {
  it('AC-0103-02: không chọn hạt, Espresso, DF64 + Gemilai, Dose điền sẵn 18', () => {
    const f = newShotForm(st, devicesTD01, NOW)
    expect(f.beanId).toBeUndefined()
    expect(f.method).toBe('espresso')
    expect([f.grinderId, f.brewerId]).toEqual(['df64', 'gemilai-3007l'])
    expect(f.vals.dose).toBe('18')
    expect(f.touched).not.toContain('dose') // chữ nhạt "điền sẵn"
    expect(f.brewedAt).toBe(NOW)
  })

  it('AC-0103-08: French Press không có Áp suất / Bloom; nhãn Thời gian ủ, Nước', () => {
    const f = changeMethod(newShotForm(st, devicesTD01, NOW), 'frenchpress', st, devicesTD01)
    const vis = visibleParams(f, devicesTD01, st.tracked)
    expect(vis).not.toContain('pressure')
    expect(vis).not.toContain('pre')
    expect(paramLabel('time', 'frenchpress')).toBe('Thời gian ủ')
    expect(paramLabel('yield', 'frenchpress')).toBe('Nước')
  })

  it('AC-0103-09: thông số tắt → không hiện, lưu rỗng', () => {
    const s = settingsTD01({ tracked: { pressure: false } })
    const f = { ...newShotForm(s, devicesTD01, NOW), beanId: 'eth' }
    expect(visibleParams(f, devicesTD01, s.tracked)).not.toContain('pressure')
    expect(toShotRecord(f, devicesTD01, s.tracked, NOW, id).pressure).toBeNull()
  })

  it('máy đang dùng bị Ẩn → Chưa chọn (bước 3)', () => {
    const devs = devicesTD01.map((d) => (d.id === 'df64' ? { ...d, status: 'hidden' as const } : d))
    expect(newShotForm(st, devs, NOW).grinderId).toBeNull()
  })
})

describe('validateShot (UC_0103 bước 15–17)', () => {
  const base = () => ({ ...newShotForm(st, devicesTD01, NOW), beanId: 'eth' })

  it('AC-0103-03: chưa chọn hạt', () => {
    const errs = validateShot(newShotForm(st, devicesTD01, NOW), devicesTD01, st.tracked)
    expect(errs).toEqual([{ field: 'bean', message: 'Chọn hạt cho shot này' }])
    expect(summaryToast(errs)).toBe('Chọn hạt cho shot này')
  })

  it('AC-0103-04: Grind 95 ngoài khoảng DF64', () => {
    const errs = validateShot({ ...base(), vals: { ...base().vals, grind: '95' } }, devicesTD01, st.tracked)
    expect(errs).toEqual([{ field: 'grind', message: 'Grind phải từ 0 đến 90 (DF64)', deviceId: 'df64' }])
    expect(summaryToast(errs)).toBe('Có 1 giá trị ngoài khoảng của thiết bị. Sửa lại hoặc đổi thiết bị')
  })

  it('AC-0103-05: biên 0 và 90 hợp lệ', () => {
    for (const g of ['0', '90']) expect(validateShot({ ...base(), vals: { grind: g } }, devicesTD01, st.tracked)).toEqual([])
  })

  it('AC-0103-06 / 07: "1.2.3" lỗi; "18,5" đọc thành 18.5', () => {
    expect(validateShot({ ...base(), vals: { dose: '1.2.3' } }, devicesTD01, st.tracked)[0].message).toBe('Nhập số, VD 18.5')
    expect(parseNumber('18,5')).toBe(18.5)
    expect(toShotRecord({ ...base(), vals: { dose: '18,5' } }, devicesTD01, st.tracked, NOW, id).dose).toBe(18.5)
  })

  it('AC-0103-10: không có máy espresso → không kiểm khoảng, brewerId rỗng', () => {
    const f = { ...base(), brewerId: null, vals: { dose: '200' } }
    expect(validateShot(f, devicesTD01, st.tracked)).toEqual([])
    const rec = toShotRecord(f, devicesTD01, st.tracked, NOW, id)
    expect([rec.dose, rec.brewerId]).toEqual([200, null])
  })
})

describe('changeMethod (UC_0103 bước 9)', () => {
  it('AC-0103-11: ô chưa sửa theo mặc định Pour Over; ô đã sửa giữ; dụng cụ pha đổi', () => {
    let f = newShotForm(st, devicesTD01, NOW)
    f = { ...f, vals: { ...f.vals, grind: '16' }, touched: ['grind'] }
    f = changeMethod(f, 'pourover', st, devicesTD01)
    expect(f.vals.dose).toBe('15')
    expect(f.vals.grind).toBe('16')
    expect(f.brewerId).toBe('hario-v60-02')
  })
})

describe('hàng chỉnh số, ratio', () => {
  it('AC-0103-12: Dose 18 → 18.1 (18.0 / 18.2); Yield 36 + 3 bước → 37.5 (37.0 / 38.0)', () => {
    const d = stepValue('18', 0.1, 1)
    expect(d).toBe('18.1')
    expect(wheelSides(d, 0.1)).toEqual(['18.0', '18.2'])
    let y = '36'
    for (let i = 0; i < 3; i++) y = stepValue(y, 0.5, 1)
    expect(y).toBe('37.5')
    expect(wheelSides(y, 0.5)).toEqual(['37.0', '38.0'])
  })
  it('không xuống dưới 0; chưa có số → − / +', () => {
    expect(stepValue('0', 0.1, -1)).toBe('0')
    expect(wheelSides('', 1)).toEqual(['−', '+'])
    expect(wheelSides('0', 1)).toEqual(['', '1'])
  })
  it('AC-0103-13: 18 / 36 → 1:2 Normale', () => {
    const r = ratio(18, 36)
    expect(fmtRatio(r)).toBe('1:2')
    expect(ratioStyle(r, 'espresso')).toBe('Normale')
    expect(ratioStyle(r, 'pourover')).toBe('')
  })
})

describe('applyReuse (BR-04 — UC_0104, UC_0105)', () => {
  it('AC-0104-01: chép hạt + thông số (đã sửa tay), không chép ghi chú, giữ ngày giờ mở form', () => {
    const f = applyReuse(newShotForm(st, devicesTD01, NOW), S2)
    expect(f.beanId).toBe('col')
    expect(f.vals).toEqual({ dose: '18.5', yield: '37', grind: '13', time: '30' })
    expect(f.touched).toEqual(expect.arrayContaining(['dose', 'yield', 'grind', 'time']))
    expect(f.notes).toBe('')
    expect(f.brewedAt).toBe(NOW)
    expect(f.src).toEqual({ time: 'manual', pressure: 'manual' })
  })
  it('AC-0105-04: pha lại không áp Giá trị mặc định (Áp suất trống)', () => {
    const f = newShotForm(st, devicesTD01, NOW, { ...S1, pressure: null })
    expect(f.vals.pressure).toBeUndefined()
    expect(f.vals.temp).toBeUndefined()
  })
})

describe('editShotForm / sửa (UC_0107)', () => {
  it('AC-0107-01: giữ id, ngày giờ pha, ngày tạo; cập nhật ngày sửa', () => {
    const f = editShotForm(S1)
    const rec = toShotRecord({ ...f, vals: { ...f.vals, grind: '15' } }, devicesTD01, st.tracked, NOW, id, S1)
    expect(rec).toMatchObject({ id: 's1', grind: 15, brewedAt: S1.brewedAt, createdAt: S1.createdAt, updatedAt: NOW })
  })
  it('AC-0107-03: đổi sang French Press → cảnh báo và bỏ Áp suất, Pre-infusion', () => {
    const f = changeMethod(editShotForm(S1), 'frenchpress', st, devicesTD01)
    expect(droppedBanner(f)).toBe('Áp suất, Pre-infusion sẽ bị bỏ khi lưu vì không dùng cho French Press')
    const rec = toShotRecord(f, devicesTD01, st.tracked, NOW, id, S1)
    expect([rec.pressure, rec.pre]).toEqual([null, null])
    expect(f.vals.dose).toBe('18') // không áp mặc định khi sửa
  })
  it('AC-0107-04: khoảng M1 thu hẹp 10–50 → Grind 60 báo lỗi', () => {
    const devs = devicesTD01.map((d) => (d.id === 'm1' ? { ...d, ranges: { grind: [10, 50] as [number, number] } } : d))
    expect(validateShot(editShotForm(S3), devs, st.tracked)[0].message).toBe('Grind phải từ 10 đến 50 (M1)')
  })
  it('AC-0107-05: Áp suất đã tắt nhưng shot có giá trị → vẫn hiện', () => {
    const s = settingsTD01({ tracked: { pressure: false } })
    expect(visibleParams(editShotForm(S1), devicesTD01, s.tracked)).toContain('pressure')
  })
})
