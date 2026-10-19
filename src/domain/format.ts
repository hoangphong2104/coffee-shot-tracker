// Định dạng hiển thị dùng chung (giờ, ngày, số). Giờ theo đồng hồ máy người dùng.

const DAY = 86_400_000
const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const p2 = (n: number) => String(n).padStart(2, '0')

export const hm = (t: number) => {
  const d = new Date(t)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}
export const dd = (t: number) => {
  const d = new Date(t)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`
}
export const ddmmyyyy = (t: number) => `${dd(t)}/${new Date(t).getFullYear()}`
export const isoDate = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}
export const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** "Hôm nay" · "Hôm qua" · "{Thứ}, {dd/MM}" */
export function dayLabel(t: number, now = Date.now()): string {
  const k = isoDate(t)
  if (k === isoDate(now)) return 'Hôm nay'
  if (k === isoDate(now - DAY)) return 'Hôm qua'
  return `${WD[new Date(t).getDay()]}, ${dd(t)}`
}

/** UC_0106 bước 2 — "{Thứ}, {dd/MM} · {HH:mm}" */
export const longDate = (t: number) => `${WD[new Date(t).getDay()]}, ${dd(t)} · ${hm(t)}`

/** Số ngày từ ngày rang (yyyy-MM-dd) tới thời điểm `at`. */
export const daysSince = (iso: string, at: number) => Math.floor((at - new Date(iso + 'T00:00:00').getTime()) / DAY)

/** Bỏ số 0 thừa: 18.50 → "18.5", 37 → "37". */
export const fmt = (n: number | null | undefined, digits = 2) =>
  n == null || Number.isNaN(n) ? '—' : String(Math.round(n * 10 ** digits) / 10 ** digits)

/** Giây: < 90 → "30s"; ≥ 90 → "m:ss". */
export const fmtSec = (s: number | null | undefined) =>
  s == null ? '—' : s >= 90 ? `${Math.floor(s / 60)}:${p2(Math.round(s % 60))}` : `${fmt(s, 1)}s`

/** So khớp không dấu, không phân biệt hoa thường (ô tìm). */
export const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
