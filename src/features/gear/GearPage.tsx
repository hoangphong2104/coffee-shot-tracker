import { useMemo, useSyncExternalStore } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { useBeans, useCups, useDevices, useSettings } from '../../data/hooks'
import type { Bean, Device, DeviceKind, Settings } from '../../data/types'
import { beanFieldOn, beanStats } from '../../domain/bean'
import { deviceGroups, isCurrent, KIND_LABEL, KIND_ORDER, type DeviceListFilter } from '../../domain/device'
import { daysSince } from '../../domain/format'
import { EmptyState } from '../../ui/controls'
import { Search } from '../../ui/icons'
import { BeanBag, Illustration, illuKey } from '../../ui/Illustration'
import { useHeaderAction } from '../../ui/Shell'

// SC_0500 Đồ nghề — UC_0201 (hạt) và UC_0301 (thiết bị). Bộ lọc thiết bị giữ trong phiên (UC_0301 bước 2).

type Seg = 'bean' | 'grinder' | 'brewer'
let deviceFilter: DeviceListFilter = { q: '', kind: '', hidden: false }
const subs = new Set<() => void>()
const setDeviceFilter = (p: Partial<DeviceListFilter>) => {
  deviceFilter = { ...deviceFilter, ...p }
  subs.forEach((f) => f())
}
const useDeviceFilter = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => deviceFilter)

const Plus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
    <path d="M12 4v16M4 12h16" />
  </svg>
)

export function GearPage() {
  const [sp, setSp] = useSearchParams()
  const seg = (['grinder', 'brewer'].includes(sp.get('seg') ?? '') ? sp.get('seg') : 'bean') as Seg
  const beanTab = sp.get('tab') === 'out' ? 'out' : 'active'
  const beans = useBeans()
  const devices = useDevices()
  const settings = useSettings()

  const plus = useMemo(
    () => (
      <Link to={seg === 'bean' ? '/beans/new' : '/devices/new'} aria-label={seg === 'bean' ? 'Thêm hạt' : 'Thêm thiết bị custom'} className="grid h-11 w-11 place-items-center rounded-full">
        <Plus />
      </Link>
    ),
    [seg],
  )
  useHeaderAction(plus)

  if (!beans || !devices || !settings) return null
  const n = {
    bean: beans.filter((b) => b.status === 'active').length,
    grinder: devices.filter((d) => d.kind === 'grinder' && d.status === 'active').length,
    brewer: devices.filter((d) => d.kind !== 'grinder' && d.status === 'active').length,
  }
  const go = (p: Record<string, string>) => setSp(p, { replace: true })

  return (
    <>
      <div className="seg center" role="tablist" aria-label="Đồ nghề">
        {([['bean', 'Hạt'], ['grinder', 'Máy xay'], ['brewer', 'Máy pha']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={seg === v} aria-pressed={seg === v} onClick={() => go(v === 'bean' ? {} : { seg: v })}>
            {l} ({n[v]})
          </button>
        ))}
      </div>
      {seg === 'bean' ? (
        <BeanList beans={beans} tab={beanTab} tracked={settings.tracked} onTab={(t) => go(t === 'out' ? { tab: 'out' } : {})} />
      ) : (
        <DeviceList devices={devices} section={seg} settings={settings} />
      )}
    </>
  )
}

/** UC_0201 */
function BeanList({ beans, tab, tracked, onTab }: { beans: Bean[]; tab: 'active' | 'out'; tracked: Settings['tracked']; onTab: (t: 'active' | 'out') => void }) {
  const navigate = useNavigate()
  const cups = useCups()
  const shots = useLiveQuery(() => db.shots.toArray(), [])
  if (!cups || !shots) return null
  const list = beans.filter((b) => b.status === tab).sort((a, b) => b.updatedAt - a.updatedAt)
  const cnt = (s: Bean['status']) => beans.filter((b) => b.status === s).length
  const roastOn = beanFieldOn(tracked, 'roastLevel')
  return (
    <>
      <div className="seg" role="group" aria-label="Trạng thái hạt">
        <button aria-pressed={tab === 'active'} onClick={() => onTab('active')}>Đang dùng ({cnt('active')})</button>
        <button aria-pressed={tab === 'out'} onClick={() => onTab('out')}>Đã hết ({cnt('out')})</button>
      </div>
      {!list.length ? (
        tab === 'active' ? (
          <EmptyState title="Chưa có hạt nào">
            <Link className="btn btn-primary" to="/beans/new">＋ Thêm hạt</Link>
          </EmptyState>
        ) : (
          <EmptyState title="Chưa có hạt nào đã hết" />
        )
      ) : (
        <div className="gear-grid">
          {list.map((b) => {
            const st = beanStats(b.id, shots, cups)
            return (
              <button key={b.id} className="gear" onClick={() => navigate(`/beans/${b.id}`)}>
                <div className="pic"><BeanBag roast={b.roastLevel} label={`Hình túi hạt ${b.name}`} /></div>
                <b>{b.name}</b>
                <span className="s">{[b.roaster, roastOn ? b.roastLevel : null].filter(Boolean).join(' · ')}</span>
                <span className="s num">
                  {b.roastDate ? `Rang ${daysSince(b.roastDate, Date.now())} ngày · ` : ''}
                  {st.count} shot{st.best != null ? ` · tốt nhất ${st.best}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

/** UC_0301 */
function DeviceList({ devices, section, settings }: { devices: Device[]; section: 'grinder' | 'brewer'; settings: Settings }) {
  const navigate = useNavigate()
  const f = useDeviceFilter()
  const kinds = section === 'brewer' ? KIND_ORDER.filter((k) => k !== 'grinder') : []
  const filter = { ...f, kind: section === 'grinder' ? ('' as const) : f.kind }
  const groups = deviceGroups(devices, section, filter, settings)
  return (
    <>
      <label className="input flex items-center gap-2">
        <Search />
        <input className="min-h-10 flex-1 border-0 bg-transparent outline-none" placeholder="Tìm tên máy, hãng" value={f.q} autoComplete="off" onChange={(e) => setDeviceFilter({ q: e.target.value })} />
      </label>
      {kinds.length > 0 && (
        <div className="chips" role="group" aria-label="Loại thiết bị">
          {([['', 'Tất cả'], ...kinds.map((k) => [k, KIND_LABEL[k]])] as [DeviceKind | '', string][]).map(([k, l]) => (
            <button key={k} className="chip" aria-pressed={filter.kind === k} onClick={() => setDeviceFilter({ kind: k })}>{l}</button>
          ))}
        </div>
      )}
      <label className="flex items-center justify-between small">
        <span>Hiện thiết bị đã ẩn</span>
        <input type="checkbox" className="switch" checked={f.hidden} onChange={(e) => setDeviceFilter({ hidden: e.target.checked })} />
      </label>
      {!groups.length ? (
        <EmptyState title={`Không thấy "${f.q}"`} sub="Thêm thiết bị custom?">
          <Link className="btn btn-primary" to={`/devices/new${f.q.trim() ? `?name=${encodeURIComponent(f.q.trim())}` : ''}`}>＋ Thêm thiết bị</Link>
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.kind} className="stack">
            <h2 className="section-title m-0 mb-0">{KIND_LABEL[g.kind]} ({g.items.length})</h2>
            <div className="gear-grid">
              {g.items.map((d) => (
                <button key={d.id} className="gear" onClick={() => navigate(`/devices/${d.id}`)}>
                  <div className="pic"><Illustration name={illuKey(d)} label={`Hình minh hoạ ${d.brand} ${d.name}`} /></div>
                  <b>{d.name}</b>
                  <span className="s">
                    {d.brand}
                    {d.kind === 'grinder' && d.burrType ? ` · cối ${d.burrType.toLowerCase()}${d.burrMm ? ` ${d.burrMm}mm` : ''}` : ''}
                  </span>
                  <span className="row-wrap badges">
                    {isCurrent(settings, d.id) && <span className="badge using">Đang dùng</span>}
                    {!d.builtin && <span className="badge custom">Custom</span>}
                    {d.status !== 'active' && <span className="badge">Đã ẩn</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
