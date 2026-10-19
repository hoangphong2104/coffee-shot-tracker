import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../data/db'
import { useBeans, useDevices, useSettings, useShotViews } from '../../data/hooks'
import { dayLabel, fmt, fmtSec, hm } from '../../domain/format'
import { fmtRatio, methodName, ratio, recipe } from '../../domain/shot'
import { lastRecipe, rating, waiting } from '../../domain/view'
import { S } from '../../strings.vi'
import { Rings } from '../../ui/icons'
import { ShotRow } from '../../ui/ShotRow'
import { PickList } from '../../ui/Sheet'

// SC_0001 v2.0 / UC_0001 — công thức lần trước, PHA LẠI, ly chờ thưởng thức, 3 shot gần đây.

const isStandalone = () => matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export function HomePage() {
  const views = useShotViews()
  const beans = useBeans()
  const devices = useDevices()
  const settings = useSettings()
  const navigate = useNavigate()
  const [waitSheet, setWaitSheet] = useState(false)
  if (!views || !beans || !devices || !settings) return null // khung trống khi đang đọc (NFR_001)

  // C.1 bước 2 — gợi ý cài app
  const note = !isStandalone() && !settings.installHintHidden && (
    <div className="note">
      Dùng offline? <Link className="link-btn" to="/settings/install">Cài app vào màn hình chính</Link> ·{' '}
      <button className="link-btn" aria-label="Ẩn gợi ý cài app" onClick={() => db.settings.update('main', { installHintHidden: true })}>Ẩn</button>
    </div>
  )

  if (!views.length)
    return (
      <div className="home">
        <section className="flex flex-col items-center gap-3 py-16 text-center">
          <Rings size={64} />
          <h2 className="m-0 mt-3 text-lg font-light">{S.homeEmptyTitle}</h2>
          <p className="m-0 text-sm text-muted">{S.homeEmptySub}</p>
          <Link to="/shots/new" className="btn btn-primary mt-4 min-w-[160px]">{S.homeEmptyCta}</Link>
        </section>
        {note}
      </div>
    )

  const bean = (id: string) => beans.find((b) => b.id === id)
  const dev = (id: string | null) => devices.find((d) => d.id === id)
  const last = lastRecipe(views, settings.defaultMethod)
  const r = ratio(last.dose, last.yield)
  const sub = [last.dose != null ? `${fmt(last.dose, 1)} g` : null, last.yield != null ? `${fmt(last.yield, 1)} g` : null, last.time != null ? fmtSec(last.time) : null]
    .filter(Boolean).join(' · ')
  const lr = rating(last)
  const meta = [methodName(last), dev(last.grinderId)?.name, last.grind != null ? fmt(last.grind) : null, lr != null ? `${lr}/10` : null].filter(Boolean).join(' · ')
  const wait = waiting(views)

  return (
    <div className="home">
      <span className="dash" />
      <div className="last-ring" role="group" aria-label="Công thức lần trước">
        <span className="k">LẦN TRƯỚC</span>
        <span className="big">{r ? fmtRatio(r) : '—'}</span>
        <span className="sub">{sub || '—'}</span>
      </div>
      <span className="bean">{bean(last.beanId)?.name ?? '—'}</span>
      <span className="meta">{meta}</span>
      <Link className="cta" to={`/shots/new?from=${last.id}`}>PHA LẠI</Link>
      {wait.length > 0 && (
        <button className="wait" onClick={() => (wait.length === 1 ? navigate(`/shots/${wait[0].id}/cup`) : setWaitSheet(true))}>
          {wait.length} ly chờ thưởng thức →
        </button>
      )}
      <div className="recent">
        <div className="recent-h">
          <span className="caps">Gần đây</span>
          <Link className="link-btn small" to="/history">Tất cả</Link>
        </div>
        {views.slice(0, 3).map((v) => (
          <ShotRow key={v.id} v={v} bean={bean(v.beanId)} grinder={dev(v.grinderId)} onClick={() => navigate(`/shots/${v.id}`)} />
        ))}
      </div>
      {note}
      {waitSheet && (
        <PickList
          title="Chờ thưởng thức"
          items={wait.map((v) => ({ value: v.id, text: bean(v.beanId)?.name ?? '—', sub: `${hm(v.brewedAt)} · ${dayLabel(v.brewedAt)} · ${recipe(v)}` }))}
          onPick={(id) => {
            setWaitSheet(false)
            navigate(`/shots/${id}/cup`)
          }}
          onClose={() => setWaitSheet(false)}
        />
      )}
    </div>
  )
}
