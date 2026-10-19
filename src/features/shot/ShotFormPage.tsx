import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { useActiveBeans, useBeans, useDevices, useSettings } from '../../data/hooks'
import { latestShotByMethod, saveShot } from '../../data/repos'
import type { Bean, Device, Method, Param, Settings } from '../../data/types'
import { dayLabel, daysSince, ddmmyyyy, hm } from '../../domain/format'
import {
  applyReuse, changeMethod, droppedBanner, editShotForm, formDevices, fmtRatio, MAIN4, METHODS, methodLabel, newShotForm,
  paramLabel, paramStep, parseNumber, rangeOf, ratio, ratioStyle, summaryToast, toShotRecord, UNIT, validateShot, visibleParams,
  type FieldError, type ShotForm,
} from '../../domain/shot'
import { EmptyState, ErrMsg, Group, NumberRow, SaveBar, TextField } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { Right, Warn } from '../../ui/icons'
import { useGoBack, useLeaveGuard } from '../../ui/nav'
import { AskOther, PickList, Sheet } from '../../ui/Sheet'
import { WheelRow } from '../../ui/WheelRow'
import { BeanSheet } from '../beans/BeanSheet'
import { clearDraft, getDraft, putDraft, snapshot, type Draft } from './draft'

// FE_MOD_002 — SC_0102 Ghi shot (UC_0103, UC_0104, UC_0105) và SC_0104 Sửa shot (UC_0107).

type Loaded = Draft | 'gone'

export function ShotFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const from = sp.get('from')
  const navType = useNavigationType()
  const settings = useSettings()
  const devices = useDevices()
  const { toast } = useFeedback()
  const key = mode === 'edit' ? `edit:${id}` : 'new'
  const [loaded, setLoaded] = useState<Loaded | null>(() => (navType === 'POP' ? getDraft(key) ?? null : null))

  useEffect(() => {
    if (loaded || !settings || !devices) return
    let live = true
    void (async () => {
      let d: Loaded
      if (mode === 'edit') {
        const s = await db.shots.get(id!)
        d = s ? draftOf(editShotForm(s), false) : 'gone'
      } else if (from) {
        const src = await db.shots.get(from) // UC_0105 bước 2 — kiểm lại shot nguồn
        if (!src) toast('Shot này không còn', { tone: 'error' })
        d = draftOf(newShotForm(settings, devices, Date.now(), src), !!src)
      } else d = draftOf(newShotForm(settings, devices, Date.now()), false)
      if (live) setLoaded(d)
    })()
    return () => {
      live = false
    }
  }, [loaded, settings, devices, mode, id, from, toast])

  if (loaded === 'gone') return <EmptyState title="Shot này không còn" />
  if (!loaded || !settings || !devices) return null
  return <ShotFormView key={key} draftKey={key} draft={loaded} settings={settings} devices={devices} />
}

const draftOf = (form: ShotForm, hideReuse: boolean): Draft => ({ form, initial: snapshot(form), hideReuse })

const devName = (d: Device | null) => (d ? `${d.brand} ${d.name}` : 'Chưa chọn')
const KIND: Partial<Record<Method, string>> = { espresso: 'Máy espresso', pourover: 'Dụng cụ pour over', aeropress: 'Aeropress', moka: 'Moka Pot', frenchpress: 'French Press' }

function ShotFormView({ draftKey, draft, settings, devices }: { draftKey: string; draft: Draft; settings: Settings; devices: Device[] }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { toast, confirm } = useFeedback()
  const beans = useBeans() ?? []
  const active = useActiveBeans()
  const [f, setF] = useState(draft.form)
  const [errors, setErrors] = useState<Partial<Record<FieldError['field'], FieldError>>>({})
  const [sheet, setSheet] = useState<null | 'beans' | 'newBean' | 'devices' | 'methodOther'>(null)
  const [saving, setSaving] = useState(false)
  const [focusErr, setFocusErr] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const latest = useLiveQuery(() => latestShotByMethod(db, f.method), [f.method])
  const usedOther = useLiveQuery(async () => {
    const names = (await db.shots.where('method').equals('other').toArray()).map((s) => s.methodOther ?? '')
    return [...new Set(names.filter(Boolean))]
  }, [])

  const tracked = settings.tracked
  const dirty = snapshot(f) !== draft.initial
  const { grinder, brewer } = formDevices(f, devices)
  const vis = visibleParams(f, devices, tracked)
  const bean = beans.find((b) => b.id === f.beanId)

  useEffect(() => putDraft(draftKey, { ...draft, form: f }), [draftKey, draft, f])

  // Màn con của form (video / đọc đồng hồ) và trang thiết bị (Sửa khoảng) giữ bản nháp, không hỏi.
  const release = useLeaveGuard(
    dirty,
    f.mode === 'new' ? 'Bỏ shot đang ghi?' : 'Bỏ thay đổi?',
    (next) => next.startsWith(location.hash.slice(1).split('?')[0] + '/') || next.startsWith('/devices/'),
    () => clearDraft(draftKey),
  )

  // UC_0103 bước 17 — cuộn tới lỗi đầu tiên và đặt focus.
  useEffect(() => {
    if (!focusErr) return
    const el = root.current?.querySelector<HTMLElement>('[aria-invalid="true"], #err-bean')
    el?.scrollIntoView({ block: 'center' })
    ;(el?.matches('input') ? el : el?.closest('.stack')?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true })
  }, [focusErr])

  const update = (next: ShotForm, clearErrors = false) => {
    setF(next)
    if (clearErrors) setErrors({})
  }
  const recheck = (next: ShotForm, p: FieldError['field']) => {
    const e = validateShot(next, devices, tracked).find((x) => x.field === p)
    setErrors((cur) => {
      const n = { ...cur }
      if (e) n[p] = e
      else delete n[p]
      return n
    })
  }
  const setVal = (p: Param, v: string) => {
    const next: ShotForm = {
      ...f,
      vals: { ...f.vals, [p]: v },
      touched: f.touched.includes(p) ? f.touched : [...f.touched, p],
      src: p === 'time' || p === 'pressure' ? (f.src[p] ? { ...f.src, [p]: 'manual' } : f.src) : f.src, // sửa tay → Gõ tay (bước 14)
    }
    setF(next)
    if (errors[p]) recheck(next, p)
  }
  const pickBean = (b: Pick<Bean, 'id'>) => {
    setF((x) => ({ ...x, beanId: b.id }))
    setErrors((e) => {
      const n = { ...e }
      delete n.bean
      return n
    })
  }
  const setMethod = (m: Method, other?: string) => update(changeMethod(f, m, settings, devices, other), true)

  // UC_0104
  const onReuse = async () => {
    const s = await latestShotByMethod(db, f.method)
    if (!s) return toast(`Chưa có shot ${methodLabel(f.method)}`)
    const entered = !!f.beanId || f.touched.length > 0
    if (entered && !(await confirm({ title: 'Ghi đè các ô đã nhập?', body: 'Hạt và thông số pha sẽ lấy theo shot gần nhất.', ok: 'Ghi đè' }))) return
    update(applyReuse(f, s), true)
    toast(`Đã điền theo shot ${hm(s.brewedAt)} ${dayLabel(s.brewedAt).toLowerCase()}`)
  }

  // UC_0103 bước 15–22; UC_0107 bước 7–13
  const onSave = async () => {
    const errs = validateShot(f, devices, tracked)
    if (errs.length) {
      setErrors(Object.fromEntries(errs.map((e) => [e.field, e])))
      setFocusErr((n) => n + 1)
      toast(summaryToast(errs), { tone: 'error' })
      return
    }
    setSaving(true)
    const existing = f.mode === 'edit' ? await db.shots.get(f.id!) : undefined
    if (f.mode === 'edit' && !existing) return gone()
    const rec = toShotRecord(f, devices, tracked, Date.now(), () => crypto.randomUUID(), existing)
    const r = await saveShot(db, rec, f.mode)
    if (!r.ok) {
      if (r.reason === 'gone') return gone()
      setSaving(false)
      return toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
    }
    release()
    clearDraft(draftKey)
    goBack()
    if (f.mode === 'edit') toast('Đã lưu thay đổi')
    else toast('Đã lưu shot', { action: { label: 'Thưởng thức ngay', fn: () => navigate(`/shots/${rec.id}/cup`) } })
  }
  const gone = () => {
    release()
    clearDraft(draftKey)
    toast('Shot này không còn', { tone: 'error' })
    navigate('/history', { replace: true })
  }

  const chips = (active ?? []).slice(0, 3)
  if (bean && !chips.some((b) => b.id === bean.id)) chips.unshift(bean)
  const banner = droppedBanner(f)
  const r = ratio(parseNumber(f.vals.dose), parseNumber(f.vals.yield))
  const style = ratioStyle(r, f.method)

  const wheelLabel = (p: Param) => {
    const rg = rangeOf(p, f, devices)
    const unit = p === 'grind' ? grinder?.name : UNIT[p]
    return [paramLabel(p, f.method), unit, rg ? `${rg.min}–${rg.max}` : null, f.src[p as 'time'] === 'video' ? 'từ video' : null].filter(Boolean).join(' · ')
  }
  const numRow = (p: Param) => {
    const rg = rangeOf(p, f, devices)
    return (
      <NumberRow
        key={p}
        fieldId={`f-${p}`}
        label={`${paramLabel(p, f.method)}${UNIT[p] ? ` (${UNIT[p]})` : ''}`}
        hint={rg ? `${rg.min}–${rg.max}${f.src[p as 'time'] === 'video' ? ' · từ video' : ''}` : undefined}
        value={f.vals[p] ?? ''}
        prefill={!f.touched.includes(p)}
        error={errText(errors[p])}
        onChange={(v) => setVal(p, v)}
        onBlur={() => recheck(f, p)}
      />
    )
  }
  const group = (title: string, ps: Param[]) => {
    const shown = ps.filter((p) => vis.includes(p))
    if (!shown.length) return null
    const summary = shown.filter((p) => f.vals[p]).map((p) => `${paramLabel(p, f.method)} ${f.vals[p]}`).join(' · ')
    const open = shown.some((p) => errors[p]) || (f.mode === 'edit' && shown.some((p) => f.vals[p]))
    return <Group key={title + open} title={title} summary={summary} defaultOpen={open}>{shown.map(numRow)}</Group>
  }
  // BR-02 — lỗi ngoài khoảng kèm link "Sửa khoảng thiết bị"
  const errText = (e?: FieldError) =>
    e && (
      <>
        {e.message}
        {e.deviceId && (
          <>
            {' '}
            <Link className="link-btn" style={{ padding: '0 4px', minHeight: 0 }} to={`/devices/${e.deviceId}`}>Sửa khoảng thiết bị</Link>
          </>
        )}
      </>
    )

  return (
    <div
      ref={root}
      className="flex flex-col gap-5"
      onKeyDown={(e) => {
        // platform-ui §4 — Enter ở ô số → ô kế tiếp
        const t = e.target as HTMLElement
        if (e.key !== 'Enter' || t.getAttribute('inputmode') !== 'decimal') return
        e.preventDefault()
        const ins = [...root.current!.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')]
        ins[ins.indexOf(t as HTMLInputElement) + 1]?.focus()
      }}
    >
      {f.mode === 'edit' && <div className="small muted num">Ngày giờ pha: {hm(f.brewedAt)} · {ddmmyyyy(f.brewedAt)} (không sửa được)</div>}

      <div className="seg" role="group" aria-label="Phương pháp">
        {METHODS.map((m) => (
          <button key={m.id} type="button" aria-pressed={f.method === m.id} onClick={() => f.method !== m.id && setMethod(m.id)}>{m.short}</button>
        ))}
        <button type="button" aria-pressed={f.method === 'other'} onClick={() => setSheet('methodOther')}>
          {f.method === 'other' ? f.methodOther || 'Khác' : 'Khác…'}
        </button>
      </div>

      {banner && (
        <div className="banner" role="status">
          <Warn />
          <span>{banner}</span>
        </div>
      )}

      {f.mode === 'new' && !draft.hideReuse && (
        <button className="btn btn-ghost btn-block" disabled={!latest} onClick={onReuse}>
          ↺ Dùng lại shot gần nhất{latest ? '' : ` · chưa có shot ${methodLabel(f.method)}`}
        </button>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <b className="small">
          Hạt <span className="req">*</span>
        </b>
        {active === undefined ? null : active.length || bean ? (
          <div className="chips" role="group" aria-label="Chọn hạt">
            {chips.map((b) => (
              <button key={b.id} type="button" className={`chip ${errors.bean ? 'err' : ''}`} aria-pressed={f.beanId === b.id} onClick={() => pickBean(b)}>{b.name}</button>
            ))}
            <button type="button" className={`chip ${errors.bean ? 'err' : ''}`} onClick={() => setSheet('beans')}>Hạt khác…</button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setSheet('newBean')}>＋ Thêm hạt đầu tiên</button>
        )}
        {bean && (bean.roaster || bean.roastDate) && (
          <div className="small muted">
            {[bean.roaster, bean.roastDate ? `${daysSince(bean.roastDate, Date.now())} ngày từ ngày rang` : null].filter(Boolean).join(' · ')}
          </div>
        )}
        {errors.bean && <ErrMsg id="err-bean">{errors.bean.message}</ErrMsg>}
      </div>

      <button type="button" className="li" style={{ borderTop: '1px solid var(--line)' }} onClick={() => setSheet('devices')}>
        <span className="main">
          <b className="small muted">Thiết bị</b>
          <div>{devName(grinder)} · {f.method === 'other' ? '—' : devName(brewer)}</div>
        </span>
        <Right />
      </button>

      <div className="flex flex-col">
        {MAIN4.filter((p) => vis.includes(p)).map((p) => (
          <WheelRow
            key={p}
            fieldId={`f-${p}`}
            label={wheelLabel(p)}
            value={f.vals[p] ?? ''}
            step={paramStep(p, f.method, grinder)}
            prefill={!f.touched.includes(p)}
            error={errText(errors[p])}
            onChange={(v) => setVal(p, v)}
            onBlur={() => recheck(f, p)}
          />
        ))}
      </div>
      <div className="wheel-hint">Vuốt ngang, hoặc chạm số hai bên để chỉnh · chạm số giữa để gõ</div>
      {vis.includes('dose') && vis.includes('yield') && (
        <div className="ratio-line" aria-live="polite">
          <span className="muted">Ratio</span>
          <b>{r && Number.isFinite(r) ? fmtRatio(r) : '—'}</b>
          {style && <span className="small">{style}</span>}
        </div>
      )}

      <div>
        {group('Máy pha', ['temp', 'pressure', 'pre'])}
        {group('Máy xay', ['grindTime', 'retention'])}
        {(tracked.barista !== false || tracked.notes !== false) && (
          <Group title="Khác" summary={[f.barista, f.notes].filter(Boolean).join(' · ')} defaultOpen={f.mode === 'edit' && !!(f.barista || f.notes)}>
            {tracked.barista !== false && <TextField label="Người pha" value={f.barista} onChange={(v) => setF({ ...f, barista: v })} />}
            {tracked.notes !== false && <TextField label="Ghi chú" multiline value={f.notes} onChange={(v) => setF({ ...f, notes: v })} />}
          </Group>
        )}
      </div>

      <SaveBar>
        <button className="btn btn-primary btn-block" disabled={saving || (f.mode === 'edit' && !dirty)} onClick={onSave}>
          {saving ? 'Đang lưu…' : f.mode === 'edit' ? 'Lưu thay đổi' : 'Lưu shot'}
        </button>
      </SaveBar>

      {sheet === 'methodOther' && (
        <AskOther
          title="Phương pháp khác"
          suggestions={usedOther ?? []}
          initial={f.methodOther}
          onDone={(v) => setMethod('other', v)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'beans' && (
        <PickList
          title="Chọn hạt"
          search="Tìm tên hạt, roaster"
          items={(active ?? []).map((b) => ({
            value: b.id,
            text: b.name,
            sub: [b.roaster, b.roastDate ? `${daysSince(b.roastDate, Date.now())} ngày từ ngày rang` : null].filter(Boolean).join(' · '),
            on: f.beanId === b.id,
          }))}
          onPick={(v) => {
            setSheet(null)
            pickBean({ id: v })
          }}
          onClose={() => setSheet(null)}
          footer={<button className="btn btn-ghost btn-block" onClick={() => setSheet('newBean')}>＋ Hạt mới</button>}
        />
      )}
      {sheet === 'newBean' && (
        <BeanSheet
          onClose={() => setSheet(null)}
          onSaved={(b) => {
            setSheet(null)
            pickBean(b)
          }}
        />
      )}
      {sheet === 'devices' && (
        <DeviceSheet
          form={f}
          devices={devices}
          onClose={() => setSheet(null)}
          onDone={(grinderId, brewerId) => {
            setSheet(null)
            update({ ...f, grinderId, brewerId }, true)
          }}
        />
      )}
    </div>
  )
}

/** UC_0103 bước 13 — chỉ thiết bị Hoạt động áp dụng phương pháp; không đổi DO_005. */
function DeviceSheet({ form, devices, onDone, onClose }: {
  form: ShotForm
  devices: Device[]
  onDone: (grinderId: string | null, brewerId: string | null) => void
  onClose: () => void
}) {
  const [g, setG] = useState(form.grinderId ?? '')
  const [b, setB] = useState(form.brewerId ?? '')
  const m = form.method
  const ok = (d: Device) => d.status === 'active' && (m === 'other' || d.methods.includes(m))
  const grinders = devices.filter((d) => d.kind === 'grinder' && ok(d))
  const brewers = m === 'other' ? [] : devices.filter((d) => d.kind !== 'grinder' && ok(d))
  // Thiết bị đang chọn trên form có thể đã Ẩn (chép từ shot cũ) — vẫn hiện để không mất lựa chọn.
  const withCurrent = (list: Device[], id: string | null) => {
    const cur = devices.find((d) => d.id === id)
    return cur && !list.includes(cur) ? [cur, ...list] : list
  }
  return (
    <Sheet title="Thiết bị cho shot này" onClose={onClose}>
      <label className="f">
        Máy xay
        <select className="input" value={g} onChange={(e) => setG(e.target.value)}>
          <option value="">Chưa chọn</option>
          {withCurrent(grinders, form.grinderId).map((d) => <option key={d.id} value={d.id}>{devName(d)}</option>)}
        </select>
      </label>
      {m === 'other' ? (
        <p className="hint">Phương pháp tự gõ không có dụng cụ pha trong knowledge base.</p>
      ) : (
        <label className="f">
          {KIND[m]}
          <select className="input" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Chưa chọn</option>
            {withCurrent(brewers, form.brewerId).map((d) => <option key={d.id} value={d.id}>{devName(d)}</option>)}
          </select>
        </label>
      )}
      <p className="hint">Chỉ đổi cho shot này. Thiết bị mặc định đặt ở Cài đặt chung.</p>
      <button className="btn btn-primary btn-block" onClick={() => onDone(g || null, m === 'other' ? null : b || null)}>Xong</button>
    </Sheet>
  )
}

