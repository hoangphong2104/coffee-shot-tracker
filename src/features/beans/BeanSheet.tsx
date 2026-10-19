import { useState } from 'react'
import { db } from '../../data/db'
import { useBeans, useSettings } from '../../data/hooks'
import { addBean } from '../../data/repos'
import type { Bean } from '../../data/types'
import { emptyBeanForm, toBeanRecord, validateBean, type BeanForm } from '../../domain/bean'
import { isoDate } from '../../domain/format'
import { useFeedback } from '../../ui/feedback'
import { Sheet } from '../../ui/Sheet'
import { BeanFields } from './BeanFields'

// SC_0202 dạng sheet / UC_0202 — lưu xong chọn luôn hạt vừa tạo cho shot đang ghi (bước 6).
export function BeanSheet({ onSaved, onClose }: { onSaved: (b: Bean) => void; onClose: () => void }) {
  const settings = useSettings()
  const beans = useBeans() ?? []
  const { toast } = useFeedback()
  const [f, setF] = useState<BeanForm>(emptyBeanForm)
  const [errs, setErrs] = useState<ReturnType<typeof validateBean>>({})
  const [saving, setSaving] = useState(false)
  const tracked = settings?.tracked ?? {}
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

  return (
    <Sheet title="Thêm hạt cà phê" onClose={onClose}>
      <BeanFields f={f} set={(k, v) => setF((x) => ({ ...x, [k]: v }))} errs={errs} tracked={tracked} beans={beans} today={today} />
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>
        {saving ? 'Đang lưu…' : 'Lưu hạt'}
      </button>
    </Sheet>
  )
}
