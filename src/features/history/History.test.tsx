import { fireEvent, render, screen, within } from '@testing-library/react'
import { db } from '../../data/db'
import type { Cup } from '../../data/types'
import { beansTD01, S1, S2, S3, settingsTD01 } from '../../test/td01'

// AC-0101-01 + AC-0102-01 (Critical) — Lịch sử qua App thật.
const H = 3.6e6
const now = Date.now()
const cup = (shotId: string, rating: number): Cup => ({ id: `c-${shotId}`, shotId, cuppedAt: now, updatedAt: now, drink: 'Espresso', iced: 'hot', rating })

beforeEach(async () => {
  window.location.hash = '#/history'
  await db.delete()
  await db.open()
  const { initApp } = await import('../../app/bootstrap')
  await initApp(db)
  await db.settings.put(settingsTD01())
  await db.beans.bulkAdd(beansTD01)
  // 2 shot hôm nay (8, 9) + 3 shot hôm qua
  await db.shots.bulkAdd([
    { ...S1, brewedAt: now - 1000 },
    { ...S2, brewedAt: now - 2000 },
    { ...S3, brewedAt: now - 24 * H },
    { ...S1, id: 's7', brewedAt: now - 25 * H },
    { ...S2, id: 's8', brewedAt: now - 26 * H },
  ])
  await db.cups.bulkAdd([cup('s1', 8), cup('s2', 9)])
})

it('AC-0101-01: nhóm Hôm nay "2 shot · TB 8.5" ở trên Hôm qua; tổng "5 shot"', async () => {
  const { App } = await import('../../app/App')
  render(<App />)
  const heads = await screen.findAllByRole('heading', { level: 2 })
  expect(heads.map((h) => h.textContent)).toEqual(['Hôm nay2 shot · TB 8.5', 'Hôm qua3 shot'])
  expect(screen.getByText('5 shot')).toBeInTheDocument()
})

it('AC-0102-01: lọc theo hạt Colombia Huila', async () => {
  const { App } = await import('../../app/App')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Hạt' }))
  const sheet = await screen.findByRole('dialog', { name: 'Lọc theo hạt' })
  fireEvent.click(within(sheet).getByText('Colombia Huila'))
  expect(await screen.findByRole('button', { name: '✓ Colombia Huila' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xoá lọc' })).toBeInTheDocument()
  expect(screen.getByText('2 shot')).toBeInTheDocument()
})
