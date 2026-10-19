import { cupLines, groups, newCupForm, toCupRecord, validateCup } from './cup'
import { toBeanRecord, validateBean, emptyBeanForm } from './bean'

// MOD_002 + UC_0202 — UT theo AC-0114 / AC-0106-02 / UC_0202.
const id = () => 'c-new'
const NOW = 1_000

describe('cup (UC_0114)', () => {
  it('AC-0114-02: mặc định Espresso cho shot Espresso, Đen cho Pour Over, Nóng', () => {
    expect(newCupForm('s4', 'espresso')).toMatchObject({ drink: 'Espresso', iced: 'hot' })
    expect(newCupForm('s5', 'pourover')).toMatchObject({ drink: 'Đen', iced: 'hot' })
  })

  it('AC-0114-03 / 11: nhóm theo kiểu uống', () => {
    expect(groups({ drink: 'Latte', iced: 'hot' })).toEqual({ milk: true, water: false, ice: false })
    expect(groups({ drink: 'Americano', iced: 'iced' })).toEqual({ milk: false, water: true, ice: true })
    expect(groups({ drink: 'Bạc xỉu', iced: 'hot' })).toEqual({ milk: true, water: true, ice: false })
  })

  it('AC-0114-01: Latte, Sữa tươi 180 ml, Rating 8, Acidity 6', () => {
    const f = { ...newCupForm('s4', 'espresso'), drink: 'Latte', milkType: 'Sữa tươi', vals: { milkMl: '180' }, rating: 8, acidity: 6 }
    expect(validateCup(f, {})).toEqual([])
    expect(toCupRecord(f, {}, NOW, id)).toMatchObject({ shotId: 's4', drink: 'Latte', iced: 'hot', milkType: 'Sữa tươi', milkMl: 180, rating: 8, acidity: 6, cuppedAt: NOW })
  })

  it('AC-0114-04: đổi Latte → Americano thì không lưu nhóm Sữa', () => {
    const f = { ...newCupForm('s4', 'espresso'), drink: 'Americano', milkType: 'Sữa tươi', vals: { milkMl: '180' } }
    const rec = toCupRecord(f, {}, NOW, id)
    expect([rec.milkMl, rec.milkType]).toEqual([null, null])
  })

  it('AC-0114-05 / 06 / 07: khoảng BR-11 và số không hợp lệ', () => {
    const latte = { ...newCupForm('s4', 'espresso'), drink: 'Latte' }
    expect(validateCup({ ...latte, vals: { milkMl: '1200' } }, {})).toEqual([{ field: 'milkMl', message: 'Lượng sữa phải từ 0 đến 1000' }])
    expect(validateCup({ ...latte, vals: { milkMl: '1000', milkTempC: '90' } }, {})).toEqual([])
    const am = { ...newCupForm('s4', 'espresso'), drink: 'Americano', vals: { waterMl: '1.2.3' } }
    expect(validateCup(am, {})[0].message).toBe('Nhập số, VD 180')
  })

  it('UC_0115 bước 6: sửa ly giữ id, shotId, cuppedAt', () => {
    const existing = toCupRecord(newCupForm('s1', 'espresso'), {}, 10, () => 'c1')
    const rec = toCupRecord({ ...newCupForm('s1', 'espresso'), rating: 9 }, {}, 99, id, existing)
    expect(rec).toMatchObject({ id: 'c1', shotId: 's1', cuppedAt: 10, updatedAt: 99, rating: 9 })
  })

  it('AC-0106-02: dòng sữa "Sữa tươi · 180 ml · 60 °C · bọt vừa"', () => {
    const rec = toCupRecord({ ...newCupForm('s1', 'espresso'), drink: 'Latte', milkType: 'Sữa tươi', foam: 'Vừa', vals: { milkMl: '180', milkTempC: '60' } }, {}, NOW, id)
    expect(cupLines(rec)).toEqual(['Sữa tươi · 180 ml · 60 °C · bọt vừa'])
  })
})

describe('bean (UC_0202)', () => {
  it('bắt buộc tên; ngày rang không sau hôm nay; trùng tên không chặn', () => {
    expect(validateBean({ ...emptyBeanForm(), name: '  ' }, '2026-10-18')).toEqual({ name: 'Nhập tên hạt' })
    expect(validateBean({ ...emptyBeanForm(), name: 'A', roastDate: '2026-10-19' }, '2026-10-18')).toEqual({ roastDate: 'Ngày rang không được sau hôm nay' })
    expect(validateBean({ ...emptyBeanForm(), name: 'A', roastDate: '2026-10-18' }, '2026-10-18')).toEqual({})
  })
  it('tạo hạt Đang dùng; trường đang tắt lưu rỗng', () => {
    const b = toBeanRecord({ ...emptyBeanForm(), name: ' Kenya ', roaster: 'X', roastLevel: 'Light' }, { beanRoaster: false }, NOW, () => 'b1')
    expect(b).toMatchObject({ id: 'b1', name: 'Kenya', roaster: '', roastLevel: 'Light', status: 'active', createdAt: NOW })
  })
})
