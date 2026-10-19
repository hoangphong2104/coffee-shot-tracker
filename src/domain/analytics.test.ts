import type { Cup, Shot } from '../data/types'
import { devicesTD01, NOW, S1, S2 } from '../test/td01'
import { bestShot, dataset, defaultFilter, grindDomain, grindPoints, grinderChoice, pointShots, ratioPoints } from './analytics'
import { shotViews } from './view'

// FE_MOD_007 — UT theo AC-0110 / AC-0111.
const D = 86_400_000
const mk = (id: string, ago: number, over: Partial<Shot> = {}): Shot => ({ ...S1, id, brewedAt: NOW - ago, ...over })
const cup = (shotId: string, rating: number | null, drink = 'Espresso'): Cup => ({ id: `c${shotId}`, shotId, cuppedAt: NOW, updatedAt: NOW, drink, iced: 'hot', rating })
// 6 shot Espresso DF64 có ly + rating, 1 shot chưa có ly (grind 20), 1 shot C40, 1 shot 100 ngày trước, 1 Pour Over
const shots = [
  mk('a', 1 * D, { grind: 13 }), mk('b', 2 * D, { grind: 13 }), mk('c', 3 * D, { grind: 14 }), mk('d', 4 * D, { grind: 15 }),
  mk('e', 5 * D, { grind: 12 }), { ...S2, id: 'f', brewedAt: NOW - 6 * D },
  mk('w', 0.5 * D, { grind: 20 }), mk('c40', 7 * D, { grinderId: 'comandante-c40', grind: 22 }),
  mk('old', 100 * D, { grind: 11 }), mk('po', 1 * D, { method: 'pourover' }),
]
const cups = [cup('a', 8), cup('b', 8), cup('c', 9, 'Latte'), cup('d', 6), cup('e', 7), cup('f', 9), cup('c40', 5), cup('old', 10), cup('po', 7)]
const vs = shotViews(shots, cups)
const ds = dataset(vs, defaultFilter('espresso'), NOW)

it('AC-0110-01: lọc mặc định Espresso · 90 ngày; tốt nhất = rating cao nhất, bằng nhau lấy mới hơn', () => {
  expect(ds.map((v) => v.id).sort()).toEqual(['a', 'b', 'c', 'c40', 'd', 'e', 'f', 'w'])
  const b = bestShot(ds)
  expect(b.best.id).toBe('c') // c (9) mới hơn f (9)
  expect(b.summary).toBe('7 shot · TB 7.4 · 1 chờ thưởng thức')
})

it('AC-0110-02 / 03 / 04: chỉ shot có ly; mặc định máy xay đang dùng; gộp điểm trùng', () => {
  const g = grinderChoice(ds, null, 'df64')
  expect(g.selected).toBe('df64')
  expect(grinderChoice(ds, 'comandante-c40', 'df64').selected).toBe('comandante-c40')
  expect(grinderChoice(ds, 'zzz', 'm1').selected).toBe(g.ids[0])
  const ps = grindPoints(ds, 'df64')
  expect(ps.some((p) => p.grind === 20)).toBe(false)
  expect(ps.find((p) => p.grind === 13 && p.rating === 8)).toEqual({ grind: 13, rating: 8, ids: ['a', 'b'], count: 2 })
  expect(pointShots(ps)).toBe(6)
  expect(grindPoints(ds, 'comandante-c40')).toHaveLength(1)
})

it('trục X kẹp trong khoảng grind của máy', () => {
  const df64 = devicesTD01.find((d) => d.id === 'df64')!
  expect(grindDomain(grindPoints(ds, 'df64'), df64)).toEqual([10, 17])
  expect(grindDomain([{ grind: 1, rating: 5, ids: [], count: 1 }, { grind: 89, rating: 5, ids: [], count: 1 }], df64)).toEqual([0, 90])
})

it('AC-0110-08: Tất cả → có shot 100 ngày trước; lọc kiểu uống chỉ giữ shot có ly kiểu đó', () => {
  expect(dataset(vs, { ...defaultFilter('espresso'), days: 0 }, NOW).some((v) => v.id === 'old')).toBe(true)
  expect(dataset(vs, { ...defaultFilter('espresso'), drink: 'Latte' }, NOW).map((v) => v.id)).toEqual(['c'])
})

it('AC-0111-01 / 03: ratio gồm cả shot chưa có ly, theo thời gian tăng dần; bỏ shot thiếu dose / yield', () => {
  const rp = ratioPoints(ds)
  expect(rp).toHaveLength(8)
  expect(rp.map((p) => p.at)).toEqual([...rp.map((p) => p.at)].sort((a, b) => a - b))
  expect(rp.find((p) => p.id === 'f')!.ratio).toBe(2)
  expect(ratioPoints(dataset(shotViews([mk('x', 1, { dose: null })], []), defaultFilter('espresso'), NOW))).toEqual([])
})

it('trục ratio: bước đẹp, nhãn không trùng', async () => {
  const { niceTicks, tickDecimals } = await import('./analytics')
  const t = niceTicks(2, 2.1, 4)
  expect(t).toEqual([2, 2.05, 2.1])
  expect(new Set(t.map((v) => v.toFixed(tickDecimals(t)))).size).toBe(t.length)
  expect(niceTicks(1.5, 3, 4)).toEqual([1.5, 2, 2.5, 3])
  expect(tickDecimals([2, 2.025, 2.05])).toBe(3)
  expect(tickDecimals([1.5, 2, 2.5])).toBe(1)
})
