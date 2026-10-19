// Icon nét mảnh (SD-01B §2). Tất cả aria-hidden — nghĩa nằm ở nhãn của nút.
const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const Warn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" style={{ flex: 'none', marginTop: 1 }} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5v.5" />
  </svg>
)
export const Chev = () => (
  <svg className="chev" width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.6" {...base}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const Right = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.6" style={{ flex: 'none', color: 'var(--muted)' }} {...base}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)
export const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" style={{ flex: 'none' }} {...base}>
    <path d="M5 12l5 5 9-10" />
  </svg>
)
export const Search = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="1.6" {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)
export const Rings = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" strokeWidth="0.8" className="text-faint" {...base}>
    <circle cx="24" cy="24" r="22" />
    <circle cx="24" cy="24" r="14" />
  </svg>
)
