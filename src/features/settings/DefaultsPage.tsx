import { useState } from 'react'
import { db } from '../../data/db'
import { useDevices, useSettings } from '../../data/hooks'
import { updateSettings } from '../../data/repos'
import type { Device, Method, Param, Settings } from '../../data/types'
import { devName } from '../../domain/device'
import { methodLabel, METHODS, paramLabel, parseNumber, rangeOf, UNIT, visibleParams } from '../../domain/shot'
import { NumberRow, SaveBar } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { useLeaveGuard } from '../../ui/nav'

// SC_0403 / UC_0404 — giá trị mặc định (DO_007) theo phương pháp, kiểm theo thiết bị đang dùng.

type Vals = Partial<Record<Param, string>>
const fromSettings = (st: Settings, m: Method): Vals =>
  Object.fromEntries(Object.entries(st.defaults[m] ?? {}).map(([k, v]) => [k, String(v)]))

/** Form ảo để dùng chung quy tắc hiện thông số của UC_0103 bước 5. */
const formFor = (st: Settings, m: Method, devices: Device[]) => {
  const active = (id: string | null | undefined) => (devices.find((d) => d.id === id && d.status === 'active') ? id! : null)
  return { mode: 'new' as const, keep: [], method: m, grinderId: active(st.current.grinder), brewerId: m === 'other' ? null : active(st.current[m]) }
}

export function DefaultsPage() {
  const settings = useSettings()
  const devices = useDevices()
  if (!settings || !devices) return null
  return <DefaultsView settings={settings} devices={devices} />
}

function DefaultsView({ settings, devices }: { settings: Settings; devices: Device[] }) {
  const { toast, confirm } = useFeedback()
  const [m, setM] = useState<Method>(settings.defaultMethod)
  const [vals, setVals] = useState<Vals>(() => fromSettings(settings, settings.defaultMethod))
  const [base, setBase] = useState<Vals>(vals)
  const [errs, setErrs] = useState<Partial<Record<Param, string>>>({})
  const dirty = JSON.stringify(vals) !== JSON.stringify(base)
  useLeaveGuard(dirty, 'Bỏ thay đổi?')
  const f = formFor(settings, m, devices)
  const keys = visibleParams(f, devices, settings.tracked)
  const grinder = devices.find((d) => d.id === f.grinderId)
  const brewer = devices.find((d) => d.id === f.brewerId)

  const switchMethod = async (next: Method) => {
    if (next === m) return
    if (dirty && !(await confirm({ title: 'Bỏ thay đổi chưa lưu?', ok: 'Bỏ', cancel: 'Ở lại', danger: true }))) return
    const v = fromSettings(settings, next)
    setM(next)
    setVals(v)
    setBase(v)
    setErrs({})
  }

  const save = async () => {
    const e: Partial<Record<Param, string>> = {}
    const out: Partial<Record<Param, number>> = {}
    for (const k of keys) {
      const v = parseNumber(vals[k])
      if (v == null) continue
      if (Number.isNaN(v)) { e[k] = 'Nhập số, VD 18.5'; continue }
      const r = rangeOf(k, f, devices)
      if (r && (v < r.min || v > r.max)) { e[k] = `${paramLabel(k, m)} phải từ ${r.min} đến ${r.max} (${r.device.name})`; continue }
      out[k] = v
    }
    setErrs(e)
    if (Object.keys(e).length) return
    try {
      await updateSettings(db, { defaults: { ...settings.defaults, [m]: out } }, Date.now()) // thay toàn bộ DO_007 của phương pháp
      const v = Object.fromEntries(Object.entries(out).map(([k, x]) => [k, String(x)]))
      setVals(v)
      setBase(v)
      toast(`Đã lưu mặc định cho ${methodLabel(m)}`)
    } catch {
      toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
    }
  }

  return (
    <>
      <div className="seg" role="group" aria-label="Phương pháp">
        {METHODS.map((x) => (
          <button key={x.id} aria-pressed={m === x.id} onClick={() => switchMethod(x.id)}>{x.short}</button>
        ))}
      </div>
      <div className="hint">Dùng lại shot gần nhất sẽ ghi đè các giá trị này.</div>
      <div className="hint">Kiểm tra theo: {devName(grinder)} · {devName(brewer)}</div>
      <div className="card stack">
        {keys.map((k) => {
          const r = rangeOf(k, f, devices)
          return (
            <NumberRow
              key={k}
              fieldId={`dv-${k}`}
              label={`${paramLabel(k, m)}${UNIT[k] ? ` (${UNIT[k]})` : ''}`}
              hint={r ? `${r.min}–${r.max}` : undefined}
              value={vals[k] ?? ''}
              error={errs[k]}
              onChange={(v) => setVals((x) => ({ ...x, [k]: v }))}
            />
          )
        })}
      </div>
      <div className="hint">Ô trống sẽ để trống khi ghi shot mới.</div>
      <SaveBar>
        <button className="btn btn-primary btn-block" onClick={save}>Lưu</button>
      </SaveBar>
    </>
  )
}
