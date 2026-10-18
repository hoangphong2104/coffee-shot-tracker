import { render, screen } from '@testing-library/react'
import { App } from './App'
import { db } from '../data/db'
import { S } from '../strings.vi'

// AC-0901-01 + AC-0001-02 — lần đầu mở app: nạp dữ liệu rồi hiện SC_0001 trạng thái trống.
afterEach(async () => {
  await db.delete()
  await db.open()
})

it('lần đầu mở app hiện trạng thái trống và thanh tab', async () => {
  render(<App />)
  expect(await screen.findByText(S.homeEmptyTitle)).toBeInTheDocument()
  expect(screen.getByText(S.homeEmptySub)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: S.homeEmptyCta })).toHaveAttribute('href', '#/shots/new')
  expect(screen.getByRole('link', { name: S.tabs.newShot })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: S.settings })).toHaveAttribute('href', '#/settings')
})

it('bộ nhớ không mở được → màn lỗi có Thử lại (AC-0901-05)', async () => {
  vi.spyOn(db, 'open').mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'InvalidStateError' }))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent(S.initError)
  expect(screen.getByRole('button', { name: S.retry })).toBeInTheDocument()
})
