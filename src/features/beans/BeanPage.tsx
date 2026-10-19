import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../data/db'
import { useBeans, useSettings } from '../../data/hooks'
import { addBean, setBeanStatus, updateBean } from '../../data/repos'
import type { Bean, Settings } from '../../data/types'
import { applyBeanEdit, beanFormFrom, beanStats, emptyBeanForm, toBeanRecord, validateBean, type BeanForm } from '../../domain/bean'
import { isoDate } from '../../domain/format'
import { EmptyState, SaveBar } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { BeanBag } from '../../ui/Illustration'
import { useGoBack, useLeaveGuard } from '../../ui/nav'
import { setHistory } from '../history/filterStore'
import { NO_FILTER } from '../../domain/view'
import { BeanFields } from './BeanFields'

// SC_0202 Thêm hạt (UC_0202) / SC_0203 Sửa hạt (UC_0203, UC_0204, UC_0205).

type Loaded = { bean?: Bean; count: number; best: number | null } | 'gone'

export function BeanPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const settings = useSettings()
  const [data, setData] = useState<Loaded | null>(mode === 'new' ? { count: 0, best: null } : null)
  useEffect(() => {
    if (mode !== 'edit') return
    let live = true
    void (async () => {
      const bean = await db.beans.get(id!)
      if (!bean) return live && setData('gone')
      const [shots, cups] = await Promise.all([db.shots.where('beanId').equals(bean.id).toArray(), db.cups.toArray()])
      if (live) setData({ bean, ...beanStats(bean.id, shots, cups) })
    })()
    return () => {
      live = false
    }
  }, [mode, id])
  if (data === 'gone') return <EmptyState title="Hạt này không còn" />
  if (!data || !settings) return null
  return <BeanView key={data.bean?.id ?? 'new'} {...data} settings={settings} />
}

function BeanView({ bean, count, best, settings }: { bean?: Bean; count: number; best: number | null; settings: Settings }) {
  const navigate = useNavigate()
  const { toast } = useFeedback()
  const beans = useBeans() ?? []
  const initial = useMemo(() => (bean ? beanFormFrom(bean) : emptyBeanForm()), [bean])
  const [f, setF] = useState<BeanForm>(initial)
  const [errs, setErrs] = useState<ReturnType<typeof validateBean>>({})
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(initial)
  const release = useLeaveGuard(dirty, bean ? 'Bỏ thay đổi?' : 'Bỏ hạt đang nhập?')
  const today = isoDate(Date.now())
  const goBack = useGoBack()
  const toList = () => goBack('/gear') // về SC_0500 mục Hạt
  const fail = () => toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
  const gone = () => {
    release()
    toast('Hạt này không còn', { tone: 'error' })
    toList()
  }

  const save = async () => {
    const e = validateBean(f, today)
    setErrs(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      if (!bean) {
        await addBean(db, toBeanRecord(f, settings.tracked, Date.now(), () => crypto.randomUUID()))
        release()
        toList()
        return toast('Đã thêm hạt')
      }
      const r = await updateBean(db, applyBeanEdit(bean, f, settings.tracked, Date.now()))
      if (r === 'gone') return gone()
      release()
      toList()
      toast('Đã lưu hạt')
    } catch {
      setSaving(false)
      fail()
    }
  }

  // UC_0204 / UC_0205 — không hỏi; thay đổi chưa lưu trên form bị bỏ
  const setStatus = async (status: Bean['status']) => {
    try {
      const r = await setBeanStatus(db, bean!.id, status, Date.now())
      if (r === 'gone') return gone()
      release()
      toList()
      if (r === 'ok') toast(status === 'out' ? 'Đã chuyển sang Đã hết' : 'Đã chuyển về Đang dùng')
    } catch {
      fail()
    }
  }

  return (
    <>
      <div className="hero-pic">
        <div style={{ width: 120 }}><BeanBag roast={f.roastLevel} label="Hình túi hạt" /></div>
      </div>
      {bean && count > 0 && <div className="banner">Thay đổi áp dụng cho {count} shot đã ghi</div>}
      <BeanFields f={f} set={(k, v) => setF((x) => ({ ...x, [k]: v }))} errs={errs} tracked={settings.tracked} beans={beans} today={today} />
      {bean && (
        <>
          <div className="card stack" style={{ gap: 6 }}>
            <div className="num">{count} shot{best != null ? ` · rating cao nhất ${best}` : ''}</div>
            {count > 0 && (
              <button
                className="link-btn self-start"
                style={{ padding: 0 }}
                onClick={() => {
                  // UC_0102 bước 9 — lọc Hạt = hạt này, bỏ các lọc khác
                  setHistory({ filter: { ...NO_FILTER, bean: bean.id }, limit: 30, scrollY: 0 })
                  navigate('/history')
                }}
              >
                Xem shot
              </button>
            )}
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => setStatus(bean.status === 'active' ? 'out' : 'active')}>
            {bean.status === 'active' ? 'Đánh dấu đã hết' : 'Dùng lại hạt này'}
          </button>
          <p className="hint m-0">Hạt đã hết sẽ không hiện khi chọn hạt cho shot mới, lịch sử vẫn giữ nguyên.</p>
        </>
      )}
      <SaveBar>
        <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>
          {saving ? 'Đang lưu…' : bean ? 'Lưu thay đổi' : 'Lưu hạt'}
        </button>
      </SaveBar>
    </>
  )
}
