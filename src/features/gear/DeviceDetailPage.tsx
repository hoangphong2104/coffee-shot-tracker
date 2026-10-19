import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { useSettings } from '../../data/hooks'
import { setCurrentDevice, setDeviceStatus, setGaugeMax } from '../../data/repos'
import {
  CONF_LABEL, devName, isCurrent, KIND_PARAMS, kindName, parseGaugeMax, rangeLabel, rangeUnit, slotFor, slotLabel,
} from '../../domain/device'
import { methodLabel } from '../../domain/shot'
import { EmptyState } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { Burr, Illustration, illuKey } from '../../ui/Illustration'
import { useHeaderAction } from '../../ui/Shell'
import { AskOther } from '../../ui/Sheet'

// SC_0302 / UC_0302 (+ UC_0305 ẩn, UC_0306 nhân bản, UC_0307 hiện lại).

export function DeviceDetailPage() {
  const { id } = useParams()
  const settings = useSettings()
  const { toast, confirm } = useFeedback()
  const [gaugeSheet, setGaugeSheet] = useState(false)
  const data = useLiveQuery(async () => {
    const d = await db.devices.get(id!)
    if (!d) return null
    return { d, origin: d.clonedFrom ? await db.devices.get(d.clonedFrom) : undefined }
  }, [id])

  const edit = useMemo(() => (data && !data.d.builtin ? <Link className="link-btn" to={`/devices/${id}/edit`}>Sửa</Link> : null), [data, id])
  useHeaderAction(edit)

  if (data === undefined || !settings) return null
  if (data === null) return <EmptyState title="Không tìm thấy thiết bị" />
  const { d, origin } = data
  const cur = isCurrent(settings, d.id)
  const keys = KIND_PARAMS[d.kind]
  const has = keys.filter((p) => d.ranges[p])
  const na = keys.filter((p) => !d.ranges[p])
  const fail = () => toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })

  const use = async () => {
    const slot = slotFor(d)
    try {
      if ((await setCurrentDevice(db, slot, d.id, Date.now())) === 'gone') return toast('Không tìm thấy thiết bị', { tone: 'error' })
      toast(`Đã đặt ${d.name} làm ${slotLabel(slot)} đang dùng`)
    } catch {
      fail()
    }
  }
  const hide = async () => {
    if (!(await confirm({ title: `Ẩn ${d.name}?`, body: 'Shot cũ vẫn giữ thiết bị này.', ok: 'Ẩn' }))) return
    try {
      const r = await setDeviceStatus(db, d.id, 'hidden', Date.now())
      if (r.r === 'ok') toast(r.cleared ? 'Đã ẩn. Hãy chọn thiết bị khác ở Cài đặt' : 'Đã ẩn thiết bị')
    } catch {
      fail()
    }
  }
  const show = async () => {
    try {
      if ((await setDeviceStatus(db, d.id, 'active', Date.now())).r === 'ok') toast('Đã hiện lại thiết bị')
    } catch {
      fail()
    }
  }

  return (
    <>
      <div className="hero-pic"><Illustration name={illuKey(d)} label={`Hình minh hoạ ${devName(d)}`} /></div>
      <div className="stack" style={{ gap: 6 }}>
        <h2 className="m-0 text-[22px] font-light">{devName(d)}</h2>
        <div className="row-wrap badges">
          <span className="badge">{kindName(d)}</span>
          <span className={`badge ${d.builtin ? '' : 'custom'}`}>{d.builtin ? 'Có sẵn' : 'Custom'}</span>
          {cur && <span className="badge using">Đang dùng</span>}
          {d.status !== 'active' && <span className="badge">Đã ẩn</span>}
        </div>
        {origin && <div className="small muted">Nhân bản từ {devName(origin)}</div>}
      </div>

      <div className="card">
        <dl className="kv">
          <dt>Kiểu vận hành</dt>
          <dd>{d.op || '—'}</dd>
          <dt>Phương pháp</dt>
          <dd>{d.methods.map(methodLabel).join(', ') || '—'}</dd>
          {d.kind === 'grinder' && (
            <>
              <dt>Đơn vị grind</dt>
              <dd>{d.grindUnit || '—'}</dd>
            </>
          )}
          {d.kind === 'espresso' && (
            <>
              <dt>Đồng hồ áp</dt>
              <dd>
                {d.gauge ? `Có · thang 0–${d.gauge.max} bar` : 'Không'}
                {d.gauge && d.builtin && (
                  <div><button className="link-btn small" style={{ minHeight: 0, padding: '4px 0' }} onClick={() => setGaugeSheet(true)}>Sửa thang</button></div>
                )}
              </dd>
            </>
          )}
          {d.builtin && (
            <>
              <dt>Độ tin cậy số liệu</dt>
              <dd>{(d.conf && CONF_LABEL[d.conf]) || '—'}</dd>
            </>
          )}
        </dl>
        {d.features && <p className="small mb-0 mt-3">{d.features}</p>}
      </div>

      {d.kind === 'grinder' && (
        <div className="card flex items-center gap-3.5">
          <div style={{ width: 96, flex: 'none' }}><Burr type={d.burrType} /></div>
          <div className="stack" style={{ gap: 2 }}>
            <b className="font-normal">Cối {d.burrType ? d.burrType.toLowerCase() : 'chưa rõ loại'}</b>
            <span className="muted num">{d.burrMm ? `${d.burrMm} mm` : 'Chưa có đường kính'}</span>
          </div>
        </div>
      )}
      <div className="small muted">Hình nét vẽ minh hoạ theo dáng dòng máy, không phải ảnh thật.</div>

      <h2 className="section-title m-0">Khoảng hợp lệ</h2>
      {has.length ? (
        <div className="card" style={{ padding: '4px 0' }}>
          <table className="tbl">
            <tbody>
              {has.map((p) => {
                const u = rangeUnit(p, d)
                return (
                  <tr key={p}>
                    <td>{rangeLabel(p, d.kind)}{u ? ` (${u})` : ''}</td>
                    <td className="num text-right"><b className="font-normal">{d.ranges[p]![0]} – {d.ranges[p]![1]}</b></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Chưa có khoảng thông số nào">
          {!d.builtin && <Link className="btn btn-ghost" to={`/devices/${d.id}/edit`}>Sửa</Link>}
        </EmptyState>
      )}
      {na.length > 0 && <div className="small muted">Không theo dõi với thiết bị này: {na.map((p) => rangeLabel(p, d.kind)).join(', ')}</div>}
      <div className="hint">Giá trị ngoài khoảng sẽ không lưu được.{d.builtin ? ' Máy của bạn khác? Bấm Nhân bản để chỉnh.' : ''}</div>

      {!cur && d.status === 'active' && <button className="btn btn-primary btn-block" onClick={use}>Dùng thiết bị này</button>}
      {d.builtin ? (
        <Link className="btn btn-ghost btn-block" to={`/devices/new?clone=${d.id}`}>Nhân bản để chỉnh</Link>
      ) : d.status === 'active' ? (
        <button className="btn btn-danger btn-block" onClick={hide}>Ẩn thiết bị</button>
      ) : (
        <button className="btn btn-ghost btn-block" onClick={show}>Hiện lại</button>
      )}

      {gaugeSheet && d.gauge && (
        <AskOther
          title="Thang đồng hồ áp (bar)"
          suggestions={[]}
          initial={String(d.gauge.max)}
          onClose={() => setGaugeSheet(false)}
          onDone={async (v) => {
            const max = parseGaugeMax(v)
            if (max == null) return toast('Thang đồng hồ phải từ 1 đến 30 bar', { tone: 'error' })
            try {
              await setGaugeMax(db, d.id, max, Date.now())
              toast('Đã lưu thang đồng hồ')
            } catch {
              fail()
            }
          }}
        />
      )}
    </>
  )
}
