import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { cupByShot, deleteShot } from '../../data/repos'
import type { Cup, Device, Param, Shot } from '../../data/types'
import { cupLines, drinkName, TASTES } from '../../domain/cup'
import { daysSince, dd, fmt, fmtSec, fromIso, hm, longDate } from '../../domain/format'
import { fmtRatio, methodName, paramLabel, ratio, ratioStyle, recipe } from '../../domain/shot'
import { useBeans, useShotViews } from '../../data/hooks'
import { EmptyState } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { Right } from '../../ui/icons'
import { useGoBack } from '../../ui/nav'
import { useHeaderAction } from '../../ui/Shell'
import { PickList } from '../../ui/Sheet'

// SC_0103 / UC_0106 — chi tiết shot hai tab; UC_0108 xoá; So sánh → UC_0109. Video (UC_0120) nối ở CODE-007.

const devName = (d?: Device) => (d ? `${d.brand} ${d.name}` : 'Chưa chọn')

export function ShotDetailPage() {
  const { id } = useParams()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') === 'cup' ? 'cup' : 'shot'
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { confirm, toast } = useFeedback()
  const [leaving, setLeaving] = useState(false)
  const data = useLiveQuery(async () => {
    const shot = await db.shots.get(id!)
    if (!shot) return null
    const [cup, bean, grinder, brewer] = await Promise.all([
      cupByShot(db, shot.id),
      db.beans.get(shot.beanId),
      shot.grinderId ? db.devices.get(shot.grinderId) : undefined,
      shot.brewerId ? db.devices.get(shot.brewerId) : undefined,
    ])
    return { shot, cup, bean, grinder, brewer }
  }, [id])

  const editLink = useMemo(
    () => (tab === 'shot' && data ? <Link className="link-btn" to={`/shots/${id}/edit`}>Sửa</Link> : null),
    [tab, id, data],
  )
  useHeaderAction(editLink)

  if (leaving || data === undefined) return null
  if (data === null)
    return (
      <EmptyState title="Shot này không còn">
        <button className="btn btn-primary" onClick={() => navigate('/history', { replace: true })}>Về Lịch sử</button>
      </EmptyState>
    )

  const { shot, cup, bean, grinder, brewer } = data

  // UC_0108
  const onDelete = async () => {
    const ok = await confirm({ title: 'Xoá shot này?', body: 'Ly thưởng thức và video của shot cũng bị xoá. Không hoàn tác được.', ok: 'Xoá', danger: true })
    if (!ok) return
    try {
      const r = await deleteShot(db, shot.id)
      setLeaving(true)
      goBack('/history')
      toast(r === 'gone' ? 'Shot này không còn' : 'Đã xoá shot')
    } catch {
      toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="num">{longDate(shot.brewedAt)}</div>
          <div className="caps mt-1 text-muted">
            {methodName(shot)} · {cup ? drinkName(cup) : 'Chờ thưởng thức'}
          </div>
        </div>
        <div className="num text-[34px] font-extralight leading-none" aria-label={cup?.rating != null ? `Rating ${cup.rating} trên 10` : 'Chưa có rating'}>
          {cup?.rating != null ? (
            <>
              {cup.rating}
              <span className="text-sm text-muted">/10</span>
            </>
          ) : (
            '—'
          )}
        </div>
      </div>

      <div className="seg center" role="tablist">
        {(['shot', 'cup'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setSp(t === 'cup' ? { tab: 'cup' } : {}, { replace: true })}>
            {t === 'shot' ? 'Shot' : 'Thưởng thức'}
          </button>
        ))}
      </div>

      {tab === 'shot' ? (
        <ShotTab shot={shot} cup={cup} bean={bean} grinder={grinder} brewer={brewer} onDelete={onDelete} />
      ) : (
        <CupTab shotId={shot.id} cup={cup} />
      )}
    </>
  )
}

const PARAM_ORDER: (Param | 'ratio')[] = ['dose', 'yield', 'ratio', 'grind', 'grindTime', 'retention', 'temp', 'pressure', 'pre', 'time']

function ShotTab({ shot, cup, bean, grinder, brewer, onDelete }: {
  shot: Shot
  cup?: Cup
  bean?: { name: string; roaster?: string; origin?: string; roastLevel?: string | null; process?: string | null; roastDate?: string | null }
  grinder?: Device
  brewer?: Device
  onDelete: () => void
}) {
  const r = ratio(shot.dose, shot.yield)
  const value = (p: Param): string | null => {
    const v = shot[p]
    if (v == null) return null
    switch (p) {
      case 'dose': case 'yield': case 'retention': return `${fmt(v)} g`
      case 'grind': return `${fmt(v)}${grinder?.grindUnit ? ` ${grinder.grindUnit}` : ''}`
      case 'time': case 'pre': case 'grindTime': return fmtSec(v)
      case 'temp': return `${fmt(v)} °C`
      case 'pressure': return `${fmt(v)} bar`
    }
  }
  // BR-03 — chỉ dòng có giá trị, kể cả thông số đang tắt
  const rows = PARAM_ORDER.flatMap((p) => {
    if (p === 'ratio') return r ? [['Ratio', `${fmtRatio(r)}${ratioStyle(r, shot.method) ? ` ${ratioStyle(r, shot.method)}` : ''}`]] : []
    const v = value(p)
    return v ? [[paramLabel(p, shot.method), v]] : []
  })
  const beanSub = bean
    ? [bean.origin, bean.roastLevel, bean.process].filter(Boolean).join(' · ') +
      (bean.roastDate ? `${bean.origin || bean.roastLevel || bean.process ? ' · ' : ''}rang ${fromIso(bean.roastDate)} (${daysSince(bean.roastDate, shot.brewedAt)} ngày trước khi pha)` : '')
    : ''
  const edited = shot.updatedAt - shot.createdAt > 60_000
  const [comparing, setComparing] = useState(false)

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <b className="font-normal">{[bean?.name ?? '—', bean?.roaster].filter(Boolean).join(' · ')}</b>
        {beanSub && <div className="small muted">{beanSub}</div>}
      </div>
      {grinder ? (
        <Link to={`/devices/${grinder.id}`} className="li" style={{ borderTop: '1px solid var(--line)' }}>
          <span className="main">{devName(grinder)} · {devName(brewer)}</span>
          <Right />
        </Link>
      ) : (
        <div className="li" style={{ borderTop: '1px solid var(--line)' }}>{devName(grinder)} · {devName(brewer)}</div>
      )}

      {rows.length ? (
        <dl className="kv">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted m-0">Chưa có thông số</p>
      )}

      {(shot.barista || shot.notes) && (
        <div className="stack card" style={{ gap: 6 }}>
          {shot.barista && <div><span className="muted">Người pha</span> · {shot.barista}</div>}
          {shot.notes && <p className="m-0 whitespace-pre-wrap">{shot.notes}</p>}
        </div>
      )}
      {edited && <div className="small muted num">Sửa lần cuối {hm(shot.updatedAt)} · {dd(shot.updatedAt)}</div>}

      <div className="grid grid-cols-2 gap-2.5">
        {!cup && <Link className="btn btn-primary col-span-2" to={`/shots/${shot.id}/cup`}>Thưởng thức</Link>}
        <Link className="btn btn-ghost" to={`/shots/new?from=${shot.id}`}>Pha lại</Link>
        <button className="btn btn-ghost" onClick={() => setComparing(true)}>So sánh</button>
        <button className="btn btn-danger col-span-2" onClick={onDelete}>Xoá</button>
      </div>
      {comparing && <CompareWith shot={shot} onClose={() => setComparing(false)} />}
    </>
  )
}

function CupTab({ shotId, cup }: { shotId: string; cup?: Cup }) {
  const url = useMemo(() => (cup?.photo ? URL.createObjectURL(cup.photo) : null), [cup?.photo])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  if (!cup)
    return (
      <EmptyState title="Chưa thưởng thức" sub="Ghi ly đồ uống và chấm vị khi bạn uống">
        <Link className="btn btn-primary" to={`/shots/${shotId}/cup`}>Thưởng thức</Link>
      </EmptyState>
    )

  const lines = cupLines(cup)
  const tastes = TASTES.filter(([k]) => cup[k] != null)
  return (
    <>
      {url && <img className="photo" src={url} alt="Ảnh ly" />}
      <div className="stack" style={{ gap: 4 }}>
        <b className="text-lg font-light">{drinkName(cup)}</b>
        {lines.length ? lines.map((l) => <div key={l} className="small">{l}</div>) : <div className="small muted">Uống nguyên bản</div>}
        <div className="small muted num">Thưởng thức lúc {hm(cup.cuppedAt)} · {dd(cup.cuppedAt)}</div>
      </div>
      {tastes.length || cup.tasteNotes || cup.rating != null ? (
        <div className="stack">
          {tastes.map(([k, label]) => (
            <div key={k} className="stack" style={{ gap: 6 }} role="img" aria-label={`${label} ${cup[k]} trên 10`}>
              <div className="flex justify-between small" aria-hidden="true">
                <span>{label}</span>
                <span className="num">{cup[k]}</span>
              </div>
              <div className="bar" aria-hidden="true"><i style={{ width: `${cup[k]! * 10}%` }} /></div>
            </div>
          ))}
          {cup.tasteNotes && <p className="m-0 whitespace-pre-wrap">{cup.tasteNotes}</p>}
        </div>
      ) : (
        <p className="muted m-0">Chưa chấm vị</p>
      )}
      <Link className="btn btn-ghost" to={`/shots/${shotId}/cup`}>Sửa thưởng thức</Link>
    </>
  )
}

/** UC_0106 bước 3 — sheet "So sánh với shot": shot khác, tìm theo tên hạt → SC_0105 (A = shot đang xem). */
function CompareWith({ shot, onClose }: { shot: Shot; onClose: () => void }) {
  const navigate = useNavigate()
  const views = useShotViews()
  const beans = useBeans()
  if (!views || !beans) return null
  const name = (id: string) => beans.find((b) => b.id === id)?.name ?? '—'
  return (
    <PickList
      title="So sánh với shot"
      search="Tìm theo tên hạt"
      items={views
        .filter((v) => v.id !== shot.id)
        .map((v) => ({ value: v.id, text: `${dd(v.brewedAt)} ${hm(v.brewedAt)} · ${name(v.beanId)}`, sub: `${methodName(v)} · ${recipe(v)}`, search: name(v.beanId) }))}
      onPick={(id) => {
        onClose()
        navigate(`/compare?a=${shot.id}&b=${id}`)
      }}
      onClose={onClose}
    />
  )
}
