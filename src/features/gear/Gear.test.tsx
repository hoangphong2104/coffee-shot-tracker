import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../../data/db'
import { settingsTD01 } from '../../test/td01'

// AC-0303-01 + AC-0302-01 (Critical) — qua App thật.
beforeEach(async () => {
  await db.delete()
  await db.open()
  const { initApp } = await import('../../app/bootstrap')
  await initApp(db)
  await db.settings.put(settingsTD01())
})

it('AC-0303-01: thêm Lelit Bianca (espresso, khoảng mặc định, có đồng hồ áp) → mở chi tiết máy mới', async () => {
  window.location.hash = '#/devices/new'
  const { App } = await import('../../app/App')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Máy espresso' }))
  fireEvent.change(screen.getByRole('textbox', { name: /Tên thiết bị/ }), { target: { value: 'Bianca' } })
  fireEvent.change(screen.getByLabelText(/^Hãng/), { target: { value: 'Lelit' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Có đồng hồ áp/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết bị' }))

  await waitFor(async () => expect((await db.devices.toArray()).filter((x) => x.name === 'Bianca' && !x.builtin)).toHaveLength(1))
  const d = (await db.devices.toArray()).find((x) => x.name === 'Bianca' && !x.builtin)!
  expect(d).toMatchObject({ brand: 'Lelit', kind: 'espresso', builtin: false, status: 'active', gauge: { max: 16 } })
  expect(d.ranges).toEqual({ dose: [7, 25], temp: [80, 100], pressure: [0, 16], pre: [0, 30], time: [5, 120], yield: [5, 120] })
  expect(await screen.findByRole('heading', { name: 'Lelit Bianca' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Đã thêm thiết bị')
})

it('AC-0302-01: chi tiết DF64', async () => {
  window.location.hash = '#/devices/df64'
  const { App } = await import('../../app/App')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Turin DF64' })).toBeInTheDocument()
  expect(screen.getByText('Đang dùng')).toBeInTheDocument()
  expect(screen.getByText('Cối phẳng')).toBeInTheDocument()
  expect(screen.getByText('64 mm')).toBeInTheDocument()
  expect(screen.getByText('0 – 90')).toBeInTheDocument()
  expect(screen.getByText(/Máy của bạn khác\? Bấm Nhân bản để chỉnh\./)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhân bản để chỉnh' })).toBeInTheDocument()
})
