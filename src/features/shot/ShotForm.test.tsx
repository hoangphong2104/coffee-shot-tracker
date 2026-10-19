import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { db } from '../../data/db'
import { beansTD01, settingsTD01 } from '../../test/td01'

// AC-0103-01 / 02 / 03 (Critical) — chạy qua App thật: router hash, nạp dữ liệu, form, lưu vào IndexedDB.

beforeEach(async () => {
  window.location.hash = '#/shots/new'
  await db.delete()
  await db.open()
})

async function openForm() {
  const { initApp } = await import('../../app/bootstrap')
  await initApp(db)
  await db.settings.put(settingsTD01())
  await db.beans.bulkAdd(beansTD01)
  const { App } = await import('../../app/App')
  render(<App />)
  return screen.findByRole('button', { name: 'Lưu shot' })
}

it('AC-0103-02: trạng thái đầu — không chọn hạt, Espresso, DF64 · Gemilai, Dose 18 điền sẵn', async () => {
  await openForm()
  expect(screen.getByRole('button', { name: 'Espresso' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Turin DF64 · Gemilai 3007L')).toBeInTheDocument()
  const dose = screen.getByLabelText(/^Dose/) as HTMLInputElement
  expect(dose.value).toBe('18')
  expect(dose).toHaveClass('prefill')
  expect(await screen.findByRole('button', { name: 'Ethiopia Yirgacheffe' })).toHaveAttribute('aria-pressed', 'false')
})

it('AC-0103-03 rồi AC-0103-01: chưa chọn hạt bị chặn; chọn hạt, chỉnh số, lưu → tạo 1 shot', async () => {
  const save = await openForm()
  fireEvent.click(save)
  expect(await screen.findByRole('status')).toHaveTextContent('Chọn hạt cho shot này')
  expect(await db.shots.count()).toBe(0)

  fireEvent.click(await screen.findByRole('button', { name: 'Ethiopia Yirgacheffe' }))
  fireEvent.change(screen.getByLabelText(/^Yield/), { target: { value: '36' } })
  fireEvent.change(screen.getByLabelText(/^Grind ·/), { target: { value: '14' } })
  fireEvent.change(screen.getByLabelText(/^Shot time/), { target: { value: '29' } })
  fireEvent.click(save)

  await waitFor(async () => expect(await db.shots.count()).toBe(1))
  const s = (await db.shots.toArray())[0]
  expect(s).toMatchObject({ method: 'espresso', beanId: 'eth', grinderId: 'df64', brewerId: 'gemilai-3007l', dose: 18, yield: 36, grind: 14, time: 29 })
  expect(await screen.findByRole('button', { name: 'Thưởng thức ngay' })).toBeInTheDocument()
})
