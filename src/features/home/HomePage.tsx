import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { S } from '../../strings.vi'
import { PlaceholderPage } from '../placeholder/PlaceholderPage'

// SC_0001 / UC_0001 — CODE-001 chỉ làm trạng thái trống (C.1 3, AC-0001-02). Phần có shot (C.1 4) ở CODE-003.
export function HomePage() {
  const count = useLiveQuery(() => db.shots.count(), [])
  if (count === undefined) return null // khung trống khi đang đọc (NFR_001)
  if (count > 0) return <PlaceholderPage />

  return (
    <section className="flex flex-col items-center gap-3 py-20 text-center">
      <svg width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-faint" aria-hidden="true">
        <circle cx="24" cy="24" r="22" />
        <circle cx="24" cy="24" r="14" />
      </svg>
      <h2 className="m-0 mt-3 text-lg font-light">{S.homeEmptyTitle}</h2>
      <p className="m-0 text-sm text-muted">{S.homeEmptySub}</p>
      <Link to="/shots/new" className="btn btn-primary mt-4 min-w-[160px]">
        {S.homeEmptyCta}
      </Link>
    </section>
  )
}
