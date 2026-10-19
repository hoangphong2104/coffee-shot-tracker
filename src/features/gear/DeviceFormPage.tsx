import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../../data/db'
import { useDevices } from '../../data/hooks'
import { addDevice, updateDevice } from '../../data/repos'
import type { Device, DeviceKind, Method, Param } from '../../data/types'
import {
  ALL_METHODS, BURRS, changeKind, formFromDevice, GRIND_UNITS, KIND_LABEL, KIND_ORDER, KIND_PARAMS, kindName, newDeviceForm, rangeLabel,
  shotsUsing, toDeviceRecord, toggleGauge, toggleRange, validateDevice, type DeviceErrors, type DeviceForm,
} from '../../domain/device'
import { methodLabel, UNIT } from '../../domain/shot'
import { ChoiceChips, EmptyState, ErrMsg, SaveBar, TextField } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { Right } from '../../ui/icons'
import { Illustration, illuKey } from '../../ui/Illustration'
import { CHOICES } from '../../ui/illustrations.generated'
import { useGoBack, useLeaveGuard } from '../../ui/nav'
import { AskOther, Sheet } from '../../ui/Sheet'

// SC_0303 Thêm thiết bị (UC_0303), nhân bản (UC_0306, ?clone=) / SC_0304 Sửa thiết bị custom (UC_0304).

type Loaded = { form: DeviceForm; existing?: Device; used: number } | 'gone'

export function DeviceFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const [data, setData] = useState<Loaded | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      let r: Loaded
      if (mode === 'edit') {
        const d = await db.devices.get(id!)
        r = !d || d.builtin ? 'gone' : { form: formFromDevice(d), existing: d, used: shotsUsing(await db.shots.toArray(), d.id) }
      } else {
        const src = sp.get('clone') ? await db.devices.get(sp.get('clone')!) : undefined
        r = { form: src ? formFromDevice(src, true) : newDeviceForm(sp.get('name') ?? ''), used: 0 }
      }
      if (live) setData(r)
    })()
    return () => {
      live = false
    }
  }, [mode, id, sp])
  if (data === 'gone') return <EmptyState title="Không tìm thấy thiết bị" />
  if (!data) return null
  return <DeviceFormView {...data} />
}

function DeviceFormView({ form, existing, used }: { form: DeviceForm; existing?: Device; used: number }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const { toast } = useFeedback()
  const live = useDevices()
  const devices = useMemo(() => live ?? [], [live])
  const [f, setF] = useState(form)
  const [errs, setErrs] = useState<DeviceErrors>({})
  const [sheet, setSheet] = useState<null | 'kind' | 'unit' | 'burr' | 'illu'>(null)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(form)
  const release = useLeaveGuard(dirty, existing ? 'Bỏ thay đổi?' : 'Bỏ thiết bị đang nhập?')
  const set = <K extends keyof DeviceForm>(k: K, v: DeviceForm[K]) => setF((x) => ({ ...x, [k]: v }))
  const brands = useMemo(() => [...new Set(devices.map((d) => d.brand).filter(Boolean))], [devices])
  const usedOther = (k: 'kindOther' | 'grindUnit' | 'burrType', base: string[]) =>
    [...new Set(devices.map((d) => d[k]).filter((v): v is string => !!v && !base.includes(v)))]
  const illu = f.illustration || illuKey({ id: f.clonedFrom ?? '', kind: f.kind, illustration: '' })

  const save = async () => {
    const e = validateDevice(f)
    setErrs(e)
    if (Object.keys(e).length) return toast('Kiểm tra lại các ô báo lỗi', { tone: 'error' })
    setSaving(true)
    try {
      const rec = toDeviceRecord(f, Date.now(), () => crypto.randomUUID(), existing)
      if (!rec.illustration && f.clonedFrom) rec.illustration = illu // nhân bản giữ hình máy gốc
      if (existing) {
        if ((await updateDevice(db, rec)) === 'gone') {
          release()
          toast('Không tìm thấy thiết bị', { tone: 'error' })
          return navigate('/gear?seg=grinder', { replace: true })
        }
        release()
        goBack(`/devices/${rec.id}`)
        return toast('Đã lưu thiết bị')
      }
      await addDevice(db, rec)
      release()
      navigate(`/devices/${rec.id}`, { replace: true }) // thay SC_0303 bằng SC_0302 (UC_0303 bước 12)
      toast('Đã thêm thiết bị')
    } catch {
      setSaving(false)
      toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
    }
  }

  const rangeRow = (p: Param) => {
    const r = f.ranges[p]
    const label = rangeLabel(p, f.kind)
    const err = errs[`r_${p}`]
    const unit = p === 'grind' ? '' : UNIT[p]
    const setR = (i: 0 | 1, v: string) => set('ranges', { ...f.ranges, [p]: (i === 0 ? [v, r![1]] : [r![0], v]) as [string, string] })
    return (
      <div key={p} className="li flex-wrap" style={{ cursor: 'default' }}>
        <span className="main">
          <b>{label}</b>
          {unit && <span className="small muted"> ({unit})</span>}
        </span>
        <input type="checkbox" className="switch" checked={!!r} aria-label={`Theo dõi ${label}`} onChange={(e) => setF(toggleRange(f, p, e.target.checked))} />
        {r && (
          <div className="flex w-full items-center gap-2">
            <input className={`input num ${err ? 'err' : ''}`} inputMode="decimal" aria-label={`${label} từ`} value={r[0]} onChange={(e) => setR(0, e.target.value)} />
            <span className="muted">đến</span>
            <input className={`input num ${err ? 'err' : ''}`} inputMode="decimal" aria-label={`${label} đến`} value={r[1]} onChange={(e) => setR(1, e.target.value)} />
          </div>
        )}
        {err && <div className="w-full"><ErrMsg>{err}</ErrMsg></div>}
      </div>
    )
  }

  return (
    <>
      {existing && <div className="banner">Thiết bị này được dùng trong {used} shot. Đổi khoảng không làm thay đổi shot cũ</div>}
      {existing ? (
        <div className="card">
          <span className="small muted">Loại thiết bị</span>
          <div>
            <b className="font-normal">{kindName(existing)}</b> <span className="small muted">(không đổi được sau khi tạo)</span>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          <b className="small">
            Loại thiết bị <span className="req">*</span>
          </b>
          <div className="row-wrap" role="group" aria-label="Loại thiết bị">
            {KIND_ORDER.filter((k) => k !== 'other').map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={f.kind === k} onClick={() => f.kind !== k && setF(changeKind(f, k))}>{KIND_LABEL[k]}</button>
            ))}
            <button type="button" className="chip" aria-pressed={f.kind === 'other'} onClick={() => setSheet('kind')}>
              {f.kind === 'other' ? f.kindOther || 'Khác' : 'Khác…'}
            </button>
          </div>
          {f.kind === 'other' && <div className="hint">Loại tự gõ là dụng cụ pha, dùng bộ thông số chung. Chọn phương pháp áp dụng bên dưới.</div>}
        </div>
      )}

      <TextField label="Tên thiết bị" required value={f.name} onChange={(v) => set('name', v)} error={errs.name} />
      <TextField label="Hãng" value={f.brand} onChange={(v) => set('brand', v)} list={brands} />
      <div className="stack" style={{ gap: 6 }}>
        <b className="small">
          Phương pháp áp dụng <span className="req">*</span>
        </b>
        <div className="row-wrap" role="group" aria-label="Phương pháp áp dụng">
          {ALL_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              aria-pressed={f.methods.includes(m)}
              onClick={() => set('methods', f.methods.includes(m) ? f.methods.filter((x) => x !== m) : ([...f.methods, m] as Method[]))}
            >
              {methodLabel(m)}
            </button>
          ))}
        </div>
        {errs.methods && <ErrMsg>{errs.methods}</ErrMsg>}
      </div>
      <TextField label="Kiểu vận hành" value={f.op} onChange={(v) => set('op', v)} placeholder="VD: Điện, burr phẳng 64mm" />

      {f.kind === 'grinder' && (
        <>
          <div className="stack" style={{ gap: 6 }}>
            <b className="small">
              Đơn vị grind <span className="req">*</span>
            </b>
            <ChoiceChips label="Đơn vị grind" options={GRIND_UNITS} value={f.grindUnit} onChange={(v) => v && set('grindUnit', v)} onOther={() => setSheet('unit')} />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <b className="small">Loại cối</b>
            <ChoiceChips label="Loại cối" options={BURRS} value={f.burrType} toggle onChange={(v) => set('burrType', v)} onOther={() => setSheet('burr')} />
          </div>
          <label className="f">
            Đường kính cối (mm)
            <input className="input num" inputMode="decimal" value={f.burrMm} placeholder="VD 64" onChange={(e) => set('burrMm', e.target.value)} />
          </label>
        </>
      )}
      {f.kind === 'espresso' && (
        <>
          <label className="li" style={{ borderTop: '1px solid var(--line)' }}>
            <span className="main">
              <b>Có đồng hồ áp</b>
              <div className="s">Để app đọc kim từ video chiết xuất</div>
            </span>
            <input type="checkbox" className="switch" checked={f.gauge} onChange={(e) => setF(toggleGauge(f, e.target.checked))} />
          </label>
          {f.gauge && (
            <label className="f">
              Thang đồng hồ áp (số ở vạch lớn nhất, bar)
              <input className="input num" inputMode="decimal" value={f.gaugeMax} onChange={(e) => set('gaugeMax', e.target.value)} />
            </label>
          )}
        </>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <b className="small">Kiểu hình</b>
        <button type="button" className="card flex items-center gap-3 border-0 bg-transparent text-left" style={{ borderTop: '1px solid var(--line)', color: 'inherit' }} onClick={() => setSheet('illu')}>
          <span style={{ width: 64, flex: 'none' }}><Illustration name={illu} label="Kiểu hình đang chọn" /></span>
          <span className="flex-1">
            {CHOICES.find((c) => c[0] === illu)?.[1] ?? 'Theo loại thiết bị'}
            <div className="small muted">Chạm để chọn hình gần giống máy của bạn</div>
          </span>
          <Right />
        </button>
      </div>
      <TextField label="Thông số đặc trưng" multiline value={f.features} onChange={(v) => set('features', v)} />

      <h2 className="section-title m-0">Khoảng thông số</h2>
      <div className="hint">Nhập toàn bộ dải của máy (VD toàn bộ vạch dial). Giá trị ngoài khoảng sẽ không lưu được khi ghi shot.</div>
      <div className="list">{KIND_PARAMS[f.kind].map(rangeRow)}</div>

      <SaveBar>
        <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>
          {saving ? 'Đang lưu…' : existing ? 'Lưu thay đổi' : 'Lưu thiết bị'}
        </button>
      </SaveBar>

      {sheet === 'kind' && (
        <AskOther title="Loại thiết bị khác" suggestions={usedOther('kindOther', [])} initial={f.kindOther} onClose={() => setSheet(null)} onDone={(v) => setF(changeKind(f, 'other' as DeviceKind, v))} />
      )}
      {sheet === 'unit' && <AskOther title="Đơn vị grind khác" suggestions={usedOther('grindUnit', GRIND_UNITS)} onClose={() => setSheet(null)} onDone={(v) => set('grindUnit', v)} />}
      {sheet === 'burr' && <AskOther title="Loại cối khác" suggestions={usedOther('burrType', BURRS)} onClose={() => setSheet(null)} onDone={(v) => set('burrType', v)} />}
      {sheet === 'illu' && (
        <Sheet title="Chọn kiểu hình" onClose={() => setSheet(null)}>
          <div className="illu-pick">
            {CHOICES.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={k === illu} title={l} onClick={() => { set('illustration', k); setSheet(null) }}>
                <Illustration name={k} label={l} />
              </button>
            ))}
          </div>
          <div className="hint">Hình nét vẽ minh hoạ — chọn dáng gần nhất với máy của bạn.</div>
        </Sheet>
      )}
    </>
  )
}
