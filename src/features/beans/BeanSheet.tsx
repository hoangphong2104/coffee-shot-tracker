import { useState } from 'react'
import { db } from '../../data/db'
import { useBeans, useSettings } from '../../data/hooks'
import { addBean } from '../../data/repos'
import type { Bean } from '../../data/types'
import { beanFieldOn, emptyBeanForm, PROCESSES, ROASTS, toBeanRecord, validateBean, type BeanForm } from '../../domain/bean'
import { isoDate } from '../../domain/format'
import { ChoiceChips, TextField } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { AskOther, Sheet } from '../../ui/Sheet'

// SC_0202 dạng sheet / UC_0202 — lưu xong chọn luôn hạt vừa tạo cho shot đang ghi (bước 6).
export function BeanSheet({ onSaved, onClose }: { onSaved: (b: Bean) => void; onClose: () => void }) {
  const settings = useSettings()
  const beans = useBeans() ?? []
  const { toast } = useFeedback()
  const [f, setF] = useState<BeanForm>(emptyBeanForm)
  const [errs, setErrs] = useState<ReturnType<typeof validateBean>>({})
  const [other, setOther] = useState<'roastLevel' | 'process' | null>(null)
  const [saving, setSaving] = useState(false)
  const tracked = settings?.tracked ?? {}
  const on = (k: Parameters<typeof beanFieldOn>[1]) => beanFieldOn(tracked, k)
  const set = <K extends keyof BeanForm>(k: K, v: BeanForm[K]) => setF((x) => ({ ...x, [k]: v }))
  const used = (k: keyof Bean, base: string[] = []) =>
    [...new Set(beans.map((b) => b[k]).filter((v): v is string => typeof v === 'string' && !!v && !base.includes(v)))]
  const today = isoDate(Date.now())

  const save = async () => {
    const e = validateBean(f, today)
    setErrs(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const rec = toBeanRecord(f, tracked, Date.now(), () => crypto.randomUUID())
      await addBean(db, rec)
      toast('Đã thêm hạt')
      onSaved(rec)
    } catch {
      toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
      setSaving(false)
    }
  }

  if (other)
    return (
      <AskOther
        title={other === 'process' ? 'Process khác' : 'Roast level khác'}
        suggestions={used(other, other === 'process' ? PROCESSES : ROASTS)}
        onDone={(v) => set(other, v)}
        onClose={() => setOther(null)}
      />
    )

  return (
    <Sheet title="Thêm hạt cà phê" onClose={onClose}>
      <div className="stack">
        <TextField label="Tên hạt" required value={f.name} onChange={(v) => set('name', v)} error={errs.name} placeholder="VD: Ethiopia Yirgacheffe" />
        {on('roaster') && <TextField label="Roaster" value={f.roaster} onChange={(v) => set('roaster', v)} list={used('roaster')} />}
        {on('origin') && <TextField label="Origin" value={f.origin} onChange={(v) => set('origin', v)} list={used('origin')} placeholder="Quốc gia · vùng" />}
        {on('roastLevel') && (
          <div className="stack" style={{ gap: 6 }}>
            <b className="small">Roast level</b>
            <ChoiceChips label="Roast level" options={ROASTS} value={f.roastLevel} toggle onChange={(v) => set('roastLevel', v)} onOther={() => setOther('roastLevel')} />
          </div>
        )}
        {on('process') && (
          <div className="stack" style={{ gap: 6 }}>
            <b className="small">Process</b>
            <ChoiceChips label="Process" options={PROCESSES} value={f.process} toggle onChange={(v) => set('process', v)} onOther={() => setOther('process')} />
          </div>
        )}
        {on('roastDate') && <TextField label="Ngày rang" type="date" max={today} value={f.roastDate} onChange={(v) => set('roastDate', v)} error={errs.roastDate} />}
      </div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>
        {saving ? 'Đang lưu…' : 'Lưu hạt'}
      </button>
    </Sheet>
  )
}
