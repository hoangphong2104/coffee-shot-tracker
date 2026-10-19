import { useCallback, useEffect, useRef } from 'react'
import { useBlocker, useNavigate, type BlockerFunction } from 'react-router-dom'
import { useFeedback } from './feedback'

/** Về màn trước; mở thẳng bằng link (không có lịch sử trong app) → về `fallback`. */
export function useGoBack() {
  const navigate = useNavigate()
  return useCallback(
    (fallback = '/') => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (idx > 0) navigate(-1)
      else navigate(fallback, { replace: true })
    },
    [navigate],
  )
}

/**
 * Chặn rời màn form khi có thay đổi (UC_0103 bước 23, UC_0107 bước 14, UC_0114 bước 16).
 * Trả về `release()` — gọi trước khi điều hướng sau khi lưu thành công.
 */
export function useLeaveGuard(dirty: boolean, title: string, allow?: (nextPath: string) => boolean, onDiscard?: () => void) {
  const { confirm } = useFeedback()
  const released = useRef(false)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const allowRef = useRef(allow)
  allowRef.current = allow
  const discardRef = useRef(onDiscard)
  discardRef.current = onDiscard
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) =>
        !released.current &&
        dirtyRef.current &&
        currentLocation.pathname !== nextLocation.pathname &&
        !allowRef.current?.(nextLocation.pathname),
      [],
    ),
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void confirm({ title, ok: 'Bỏ', cancel: 'Ở lại', danger: true }).then((leave) => {
      if (!leave) return blocker.reset()
      discardRef.current?.()
      blocker.proceed()
    })
  }, [blocker, confirm, title])
  return useCallback(() => {
    released.current = true
  }, [])
}
