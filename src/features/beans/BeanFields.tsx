import { useState } from 'react'
import type { Bean, Settings } from '../../data/types'
import { beanFieldOn, PROCESSES, ROASTS, type BeanForm, validateBean } from '../../domain/bean'
import { ChoiceChips, TextField } from '../../ui/controls'
import { AskOther } from '../../ui/Sheet'

// UC_0202 bước 1–2 / UC_0203 — ô nhập hạt dùng chung cho sheet trong SC_0102 và màn SC_0202 / SC_0203.
export function BeanFields({ f, set, errs, tracked, beans, today }: {
  f: BeanForm
  set: <K extends keyof BeanForm>(k: K, v: BeanForm[K]) => void
  errs: ReturnType<typeof validateBean>
  tracked: Settings['tracked']
  beans: Bean[]
  today: string
}) {
  const [other, setOther] = useState<'roastLevel' | 'process' | null>(null)
  const on = (k: Parameters<typeof beanFieldOn>[1]) => beanFieldOn(tracked, k)
  const used = (k: keyof Bean, base: string[] = []) =>
    [...new Set(beans.map((b) => b[k]).filter((v): v is string => typeof v === 'string' && !!v && !base.includes(v)))]
  return (
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
      {other && (
        <AskOther
          title={other === 'process' ? 'Process khác' : 'Roast level khác'}
          suggestions={used(other, other === 'process' ? PROCESSES : ROASTS)}
          onDone={(v) => set(other, v)}
          onClose={() => setOther(null)}
        />
      )}
    </div>
  )
}
