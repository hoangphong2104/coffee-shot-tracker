import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../data/db'
import { useDevices, useSettings } from '../../data/hooks'
import { updateSettings, setCurrentDevice } from '../../data/repos'
import type { DeviceSlot, Settings } from '../../data/types'
import { devName, kindName } from '../../domain/device'
import { methodLabel, METHODS } from '../../domain/shot'
import { useFeedback } from '../../ui/feedback'
import { Right } from '../../ui/icons'
import { PickList } from '../../ui/Sheet'

// FE_MOD_009 — SC_0400 Cài đặt, SC_0401 Cài đặt chung (UC_0401, UC_0402), SC_0402 Thông số theo dõi (UC_0403).

const FAIL = 'Không lưu được trên máy này. Kiểm tra dung lượng trống'
export const PRIVACY =
  'Dữ liệu chỉ nằm trên máy này, app không gửi đi đâu. File xuất có thể chứa tên người pha, ghi chú, ảnh ly; video chọn từ thư viện có thể mang vị trí — cẩn thận khi chia sẻ.'

const Item = ({ to, label, sub }: { to: string; label: string; sub?: string }) => (
  <Link className="li" to={to}>
    <span className="main">
      <b>{label}</b>
      {sub && <div className="s">{sub}</div>}
    </span>
    <Right />
  </Link>
)

/** SC_0400 */
export function SettingsPage() {
  return (
    <>
      <h2 className="section-title m-0">Cài đặt</h2>
      <div className="list">
        <Item to="/settings/general" label="Cài đặt chung" sub="Thiết bị đang dùng, mặc định, giao diện" />
        <Item to="/settings/tracked" label="Thông số theo dõi" />
        <Item to="/settings/defaults" label="Giá trị mặc định" />
      </div>
      <h2 className="section-title m-0">Dữ liệu</h2>
      <div className="list">
        <Item to="/settings/backup" label="Sao lưu dữ liệu" sub="Xuất JSON / CSV, nhập JSON" />
      </div>
      <h2 className="section-title m-0">Trợ giúp</h2>
      <div className="list">
        <Item to="/settings/install" label="Cài app vào màn hình chính" />
      </div>
      <p className="hint m-0">{PRIVACY}</p>
    </>
  )
}

const SLOTS: [DeviceSlot, string][] = [
  ['grinder', 'Máy xay'], ['espresso', 'Máy espresso'], ['pourover', 'Dụng cụ pour over'], ['aeropress', 'Aeropress'], ['moka', 'Moka Pot'], ['frenchpress', 'French Press'],
]

/** SC_0401 — UC_0401 (thiết bị đang dùng), UC_0402 (mặc định, giao diện). */
export function GeneralSettingsPage() {
  const settings = useSettings()
  const devices = useDevices()
  const { toast } = useFeedback()
  const [sheet, setSheet] = useState<DeviceSlot | 'method' | null>(null)
  if (!settings || !devices) return null
  const dev = (id: string | null) => devices.find((d) => d.id === id)
  const save = async (patch: Partial<Settings>, msg?: string) => {
    try {
      await updateSettings(db, patch, Date.now())
      if (msg) toast(msg)
    } catch {
      toast(FAIL, { tone: 'error' })
    }
  }

  // UC_0401 bước 2 — Không chọn + máy Hoạt động thoả ô; có sẵn trước custom, rồi Hãng Tên A→Z
  const pickItems = (slot: DeviceSlot) => [
    { value: '', text: 'Không chọn', on: !settings.current[slot] },
    ...devices
      .filter((d) => d.status === 'active' && (slot === 'grinder' ? d.kind === 'grinder' : d.kind !== 'grinder' && d.methods.includes(slot)))
      .sort((a, b) => Number(b.builtin) - Number(a.builtin) || `${a.brand}${a.name}`.localeCompare(`${b.brand}${b.name}`, 'vi'))
      .map((d) => ({
        value: d.id,
        text: devName(d),
        sub: `${d.builtin ? '' : 'Custom · '}${d.kind === 'other' ? `${kindName(d)} · ` : ''}${d.op ?? ''}`,
        on: settings.current[slot] === d.id,
        search: `${d.brand} ${d.name}`,
      })),
  ]

  return (
    <>
      <h2 className="section-title m-0">Thiết bị đang dùng</h2>
      <div className="list">
        {SLOTS.map(([slot, label]) => (
          <button key={slot} className="li" onClick={() => setSheet(slot)}>
            <span className="main"><b>{label}</b></span>
            <span className="max-w-[48%] truncate text-sm text-muted" style={settings.current[slot] ? undefined : { fontStyle: 'italic' }}>
              {settings.current[slot] ? devName(dev(settings.current[slot])) : 'Chưa chọn'}
            </span>
            <Right />
          </button>
        ))}
      </div>
      <div className="hint">
        Thiết bị đang dùng được điền sẵn khi ghi shot. Đổi máy không làm thay đổi shot cũ.{' '}
        <Link className="link-btn" style={{ padding: 0, minHeight: 0 }} to="/gear?seg=grinder">Xem đồ nghề</Link>
      </div>

      <h2 className="section-title m-0">Mặc định khi ghi shot</h2>
      <div className="list">
        <button className="li" onClick={() => setSheet('method')}>
          <span className="main"><b>Phương pháp mặc định</b></span>
          <span className="text-sm text-muted">{methodLabel(settings.defaultMethod)}</span>
          <Right />
        </button>
        <label className="li" style={{ cursor: 'default' }}>
          <span className="main"><b>Tên người pha mặc định</b></span>
          <input
            className="input"
            style={{ maxWidth: '52%', minHeight: 40 }}
            defaultValue={settings.baristaDefault}
            // UC_0402 bước 2 — lưu khi rời ô (sự kiện thay đổi)
            onBlur={(e) => e.target.value.trim() !== settings.baristaDefault && save({ baristaDefault: e.target.value.trim() }, 'Đã lưu')}
          />
        </label>
      </div>

      <h2 className="section-title m-0">Giao diện</h2>
      <div className="seg" role="group" aria-label="Giao diện">
        {([['system', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']] as const).map(([v, l]) => (
          <button key={v} aria-pressed={settings.theme === v} onClick={() => save({ theme: v })}>{l}</button>
        ))}
      </div>

      <div className="list">
        <Item to="/settings/tracked" label="Thông số theo dõi" />
        <Item to="/settings/defaults" label="Giá trị mặc định" />
      </div>

      {sheet === 'method' && (
        <PickList
          title="Phương pháp mặc định"
          items={METHODS.map((m) => ({ value: m.id, text: m.label, on: settings.defaultMethod === m.id }))}
          onPick={(v) => { setSheet(null); void save({ defaultMethod: v as Settings['defaultMethod'] }, 'Đã lưu') }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet !== 'method' && (
        <PickList
          title={SLOTS.find(([s]) => s === sheet)![1]}
          search="Tìm tên máy, hãng"
          items={pickItems(sheet)}
          onPick={async (v) => {
            const slot = sheet
            setSheet(null)
            try {
              if ((await setCurrentDevice(db, slot, v || null, Date.now())) === 'gone') return toast('Không tìm thấy thiết bị', { tone: 'error' })
              toast('Đã lưu')
            } catch {
              toast(FAIL, { tone: 'error' })
            }
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

/** DO_006 — 5 nhóm (UC_0403 bước 2). Khoá theo dõi trùng với khoá dùng ở form shot / ly / hạt. */
export const TRACK_GROUPS: [string, [string, string][]][] = [
  ['Hạt cà phê', [['beanOrigin', 'Origin'], ['beanRoastLevel', 'Roast level'], ['beanRoastDate', 'Ngày rang'], ['beanRoaster', 'Roaster'], ['beanProcess', 'Process']]],
  ['Máy xay', [['dose', 'Dose'], ['grind', 'Grind size'], ['grindTime', 'Grind time'], ['retention', 'Retention']]],
  ['Máy pha', [['temp', 'Nhiệt độ'], ['pressure', 'Áp suất'], ['pre', 'Pre-infusion / Bloom'], ['time', 'Tổng thời gian'], ['yield', 'Yield']]],
  ['Khác (shot)', [['barista', 'Tên người pha'], ['notes', 'Ghi chú']]],
  ['Thưởng thức', [
    ['drink', 'Kiểu uống'], ['iced', 'Nóng / Đá'], ['milkType', 'Loại sữa'], ['milkMl', 'Lượng sữa'], ['milkTemp', 'Nhiệt độ sữa'], ['foam', 'Độ bọt'],
    ['water', 'Nước thêm'], ['ice', 'Đá'], ['sugar', 'Đường / syrup'], ['rating', 'Rating'], ['acidity', 'Acidity'], ['sweetness', 'Sweetness'],
    ['bitterness', 'Bitterness'], ['body', 'Body'], ['tasteNotes', 'Mô tả vị'], ['photo', 'Ảnh ly'],
  ]],
]

/** SC_0402 — UC_0403: lưu ngay, không toast; lỗi ghi → công tắc về cũ (dữ liệu sống nên tự về). */
export function TrackedPage() {
  const settings = useSettings()
  const { toast } = useFeedback()
  if (!settings) return null
  const on = (k: string) => settings.tracked[k] !== false
  const toggle = async (k: string, v: boolean) => {
    try {
      await updateSettings(db, { tracked: { ...settings.tracked, [k]: v } }, Date.now())
    } catch {
      toast(FAIL, { tone: 'error' })
    }
  }
  return (
    <>
      <div className="hint">Tắt thông số không xoá dữ liệu cũ, chỉ ẩn khi ghi shot mới.</div>
      {TRACK_GROUPS.map(([g, items]) => (
        <section key={g} className="stack">
          <h2 className="section-title m-0 mb-0">{g} · {items.filter(([k]) => on(k)).length}/{items.length}</h2>
          <div className="list">
            {items.map(([k, label]) => (
              <label key={k} className="li">
                <span className="main">
                  <b>{label}</b>
                  {(k === 'dose' || k === 'yield') && !on(k) && <div className="s">Ratio cần Dose và Yield</div>}
                </span>
                <input type="checkbox" className="switch" checked={on(k)} aria-label={label} onChange={(e) => toggle(k, e.target.checked)} />
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="hint">Luôn hiện: Ngày giờ, Phương pháp, Hạt, Ratio (khi có Dose và Yield)</div>
    </>
  )
}
