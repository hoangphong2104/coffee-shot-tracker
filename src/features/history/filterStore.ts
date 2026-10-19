import { useSyncExternalStore } from 'react'
import { NO_FILTER, type HistoryFilter } from '../../domain/view'

// UC_0102 bước 8 — lọc giữ khi vào chi tiết / chuyển tab, mất khi đóng app (chỉ trong bộ nhớ).
// UC_0101 bước 5–6 — <GioiHan> và vị trí cuộn cũng giữ để quay lại thấy đúng chỗ.

interface HistoryState { filter: HistoryFilter; limit: number; scrollY: number }
let state: HistoryState = { filter: NO_FILTER, limit: 30, scrollY: 0 }
const subs = new Set<() => void>()

export const PAGE = 30
export function setHistory(patch: Partial<HistoryState>) {
  state = { ...state, ...patch }
  subs.forEach((f) => f())
}
export const useHistoryState = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
/** Chỉ cho test: về trạng thái đầu phiên. */
export const resetHistory = () => setHistory({ filter: NO_FILTER, limit: PAGE, scrollY: 0 })
