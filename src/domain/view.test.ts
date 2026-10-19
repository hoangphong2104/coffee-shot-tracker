import type { Cup, Shot } from '../data/types'
import { beansTD01, devicesTD01, NOW, S1, S2, S3 } from '../test/td01'
import { applyFilter, cardDrink, cardRecipe, compareRows, grinderBanner, groupByDay, lastRecipe, NO_FILTER, shotViews, waiting } from './view'

// FE_MOD_006 — UT theo AC-0001, AC-0101, AC-0102, AC-0109.
const H = 3.6e6
const cup = (shotId: string, over: Partial<Cup> = {}): Cup => ({ id: `c-${shotId}`, shotId, cuppedAt: NOW, updatedAt: NOW, drink: 'Espresso', iced: 'hot', ...over })
const S4: Shot = { ...S1, id: 's4', brewedAt: NOW - 0.5 * H, notes: '' }
const S5: Shot = { ...S1, id: 's5', method: 'pourover', brewerId: 'hario-v60-02', brewedAt: NOW - 0.2 * H, pressure: null, pre: null }
const S6: Shot = { ...S1, id: 's6', brewedAt: NOW - 26 * H, beanId: 'col' }
const cups = [cup('s1', { drink: 'Latte', rating: 8 }), cup('s2', { rating: 9 }), cup('s3', { rating: 7 }), cup('s6')]
const views = shotViews([S1, S2, S3, S4, S5, S6], cups)

describe('Trang chủ (UC_0001)', () => {
  it('AC-0001-05: lần trước = shot Espresso mới nhất (S2), không phải Pour Over mới hơn', () => {
    expect(views[0].id).toBe('s5')
    expect(lastRecipe(views, 'espresso').id).toBe('s4')
    expect(lastRecipe(shotViews([S1, S2, S5], cups), 'espresso').id).toBe('s2')
  })
  it('AC-0001-03 / 04: ly chờ = shot chưa có ly', () => {
    expect(waiting(views).map((v) => v.id)).toEqual(['s5', 's4'])
  })
})

describe('Lịch sử (UC_0101)', () => {
  it('AC-0101-01: nhóm Hôm nay trên Hôm qua, TB rating 1 số lẻ', () => {
    const g = groupByDay(views)
    expect(g.map((x) => x.items.length)).toEqual([5, 1])
    expect(g[0].avg).toBe('8.0') // 8, 9, 7
    expect(g[1].avg).toBeNull() // S6 có ly nhưng không chấm
  })
  it('AC-0101-02: thẻ — công thức, " click" với máy xay click', () => {
    expect(cardRecipe(S2)).toBe('18.5 g → 37 g · 1:2 · 30s · grind 13')
    const c40 = devicesTD01.find((d) => d.id === 'comandante-c40')
    expect(cardRecipe({ ...S2, grinderId: 'comandante-c40' }, c40)).toMatch(/grind 13 click$/)
    expect(cardRecipe({ ...S2, time: 95 })).toContain('1:35')
  })
  it('nhãn kiểu uống chỉ khi khác mặc định hoặc đá', () => {
    expect(cardDrink(views.find((v) => v.id === 's1')!)).toBe('Latte')
    expect(cardDrink(views.find((v) => v.id === 's2')!)).toBeNull()
    expect(cardDrink({ ...S2, cup: cup('s2', { iced: 'iced' }) })).toBe('Espresso đá')
  })
})

describe('Lọc (UC_0102)', () => {
  const ids = (f: Partial<typeof NO_FILTER>) => applyFilter(views, { ...NO_FILTER, ...f }).map((v) => v.id).sort()
  it('AC-0102-01: theo hạt', () => expect(ids({ bean: 'col' })).toEqual(['s2', 's6']))
  it('AC-0102-03: rating ≥ 8', () => expect(ids({ rating: 8 })).toEqual(['s1', 's2']))
  it('AC-0102-04: Chưa chấm gồm chưa có ly + có ly không chấm; Chờ thưởng thức chỉ chưa có ly', () => {
    expect(ids({ rating: 'none' })).toEqual(['s4', 's5', 's6'])
    expect(ids({ rating: 'waiting' })).toEqual(['s4', 's5'])
  })
  it('AC-0102-05: VÀ giữa nhóm, HOẶC trong nhóm', () => {
    expect(ids({ bean: 'eth', methods: ['espresso', 'pourover'] })).toEqual(['s1', 's3', 's4', 's5'])
    expect(ids({ bean: 'eth', methods: ['pourover'] })).toEqual(['s5'])
  })
  it('kiểu uống: chỉ shot có ly', () => expect(ids({ drinks: ['Latte', 'Espresso'] })).toEqual(['s1', 's2', 's3', 's6']))
  it('AC-0102-06: không khớp', () => expect(ids({ rating: 9, bean: 'cau' })).toEqual([]))
  it('AC-0102-07: phương pháp Khác', () => {
    const phin = shotViews([{ ...S1, id: 'p', method: 'other', methodOther: 'Phin' }, S2], [])
    expect(applyFilter(phin, { ...NO_FILTER, methods: ['other'] }).map((v) => v.id)).toEqual(['p'])
  })
})

describe('So sánh (UC_0109)', () => {
  const A = views.find((v) => v.id === 's1')!
  const B = views.find((v) => v.id === 's2')!
  const row = (rows: ReturnType<typeof compareRows>, l: string) => rows.find((r) => r.label === l)
  it('AC-0109-01: Grind -1, Yield +1; dòng giống không đánh dấu', () => {
    const rows = compareRows(A, B, beansTD01, devicesTD01)
    expect(row(rows, 'Grind')).toMatchObject({ diff: true, delta: '-1' })
    expect(row(rows, 'Yield')).toMatchObject({ diff: true, delta: '+1' })
    expect(row(rows, 'Dose')).toMatchObject({ diff: true, delta: '+0.5' })
    expect(row(rows, 'Phương pháp')).toMatchObject({ diff: false })
    expect(row(rows, 'Máy xay')).toMatchObject({ a: 'Turin DF64', diff: false })
    expect(row(rows, 'Grind time')).toBeUndefined() // cả hai trống → bỏ dòng
  })
  it('AC-0109-02: khác máy xay → banner + "khác thang"', () => {
    const C = views.find((v) => v.id === 's3')!
    expect(grinderBanner(A, C, devicesTD01)).toBe('Hai máy xay khác nhau (DF64 / M1) — grind không cùng thang')
    expect(row(compareRows(A, C, beansTD01, devicesTD01), 'Grind')?.delta).toBe('khác thang')
    expect(grinderBanner(A, B, devicesTD01)).toBeNull()
  })
  it('AC-0109-04: đổi chỗ → chênh đổi dấu', () => {
    expect(row(compareRows(B, A, beansTD01, devicesTD01), 'Grind')?.delta).toBe('+1')
  })
  it('Kiểu uống: chưa có ly → "Chờ thưởng thức"', () => {
    const D = views.find((v) => v.id === 's4')!
    expect(row(compareRows(A, D, beansTD01, devicesTD01), 'Kiểu uống')).toMatchObject({ a: 'Latte', b: 'Chờ thưởng thức', diff: true })
  })
})

