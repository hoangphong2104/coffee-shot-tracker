import { render, screen } from '@testing-library/react'
import { db } from '../../data/db'
import type { Cup, Shot } from '../../data/types'
import { beansTD01, S1, settingsTD01 } from '../../test/td01'

// AC-0110-01 (Critical) + AC-0110-06 — tab Biểu đồ qua App thật (Recharts tải lười).
const D = 86_400_000
const now = Date.now()

beforeEach(async () => {
  window.location.hash = '#/analytics'
  await db.delete()
  await db.open()
  const { initApp } = await import('../../app/bootstrap')
  await initApp(db)
  await db.settings.put(settingsTD01())
  await db.beans.bulkAdd(beansTD01)
})

it('AC-0110-06: chưa có shot → "Chưa có dữ liệu"', async () => {
  const { App } = await import('../../app/App')
  render(<App />)
  expect(await screen.findByText('Chưa có dữ liệu')).toBeInTheDocument()
  expect(screen.getByText('Ghi vài shot để xem xu hướng')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '＋ Ghi shot' })).toBeInTheDocument()
})

it('AC-0110-01: lọc mặc định; "6 shot · TB {x} · 1 chờ thưởng thức"; Grind theo rating "6 shot"', async () => {
  const ratings = [8, 7, 9, 6, 9, 8]
  const shots: Shot[] = ratings.map((_, i) => ({ ...S1, id: `s${i}`, brewedAt: now - (i + 1) * D, grind: 12 + i, createdAt: now, updatedAt: now }))
  shots.push({ ...S1, id: 'w', brewedAt: now - 0.5 * D })
  const cups: Cup[] = ratings.map((r, i) => ({ id: `c${i}`, shotId: `s${i}`, cuppedAt: now, updatedAt: now, drink: 'Espresso', iced: 'hot', rating: r }))
  await db.shots.bulkAdd(shots)
  await db.cups.bulkAdd(cups)
  const { App } = await import('../../app/App')
  render(<App />)
  expect(await screen.findByText('6 shot · TB 7.8 · 1 chờ thưởng thức')).toBeInTheDocument()
  for (const chip of ['Tất cả hạt', 'Espresso', 'Mọi kiểu uống', '90 ngày']) expect(screen.getByRole('button', { name: chip })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Grind theo rating' }).parentElement).toHaveTextContent('6 shot')
  // tốt nhất = rating 9 mới hơn (s2, grind 14)
  expect(screen.getByText('Shot tốt nhất').closest('.card')).toHaveTextContent('grind 14')
})
