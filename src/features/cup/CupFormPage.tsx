import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../../data/db'
import { useSettings } from '../../data/hooks'
import { cupByShot, GoneError, upsertCupByShot } from '../../data/repos'
import type { Bean, Cup, Settings, Shot } from '../../data/types'
import {
  CUP_NUMS, cupFormFrom, DRINKS, FOAMS, groups, MILKS, newCupForm, SUGARS, TASTES, toCupRecord, validateCup, visibleCupNums,
  type CupForm, type CupNum,
} from '../../domain/cup'
import { dayLabel, hm } from '../../domain/format'
import { methodName, recipe } from '../../domain/shot'
import { ChoiceChips, EmptyState, Group, NumberRow, SaveBar, ScaleButtons, TextField } from '../../ui/controls'
import { useFeedback } from '../../ui/feedback'
import { useGoBack, useLeaveGuard } from '../../ui/nav'
import { resizePhoto } from '../../ui/photo'
import { AskOther } from '../../ui/Sheet'

// FE_MOD_003 — SC_0107 Thưởng thức (UC_0114) / SC_0108 Sửa thưởng thức (UC_0115).

interface Loaded { shot: Shot; bean?: Bean; cup?: Cup; used: { drinks: string[]; milks: string[]; sugars: string[] } }

export function CupFormPage() {
  const { id } = useParams()
  const settings = useSettings()
  const [data, setData] = useState<Loaded | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void (async () => {
      const shot = await db.shots.get(id!)
      if (!shot) return live && setData(null)
      const [bean, cup, cups] = await Promise.all([db.beans.get(shot.beanId), cupByShot(db, shot.id), db.cups.toArray()])
      const usedOf = (k: 'drink' | 'milkType' | 'sugar', base: string[]) =>
        [...new Set(cups.map((c) => c[k]).filter((v): v is string => !!v && !base.includes(v)))]
      if (live) setData({ shot, bean, cup, used: { drinks: usedOf('drink', DRINKS), milks: usedOf('milkType', MILKS), sugars: usedOf('sugar', SUGARS) } })
    })()
    return () => {
      live = false
    }
  }, [id])

  if (data === null) return <EmptyState title="Shot này không còn" />
  if (!data || !settings) return null
  return <CupFormView data={data} settings={settings} />
}

const snap = (f: CupForm) => JSON.stringify({ ...f, photo: f.photo ? `${f.photo.size}:${f.photo.type}` : null })

function CupFormView({ data, settings }: { data: Loaded; settings: Settings }) {
  const { shot, bean, cup, used } = data
  const goBack = useGoBack()
  const { toast } = useFeedback()
  const initial = useMemo(() => (cup ? cupFormFrom(cup) : newCupForm(shot.id, shot.method)), [cup, shot])
  const [f, setF] = useState<CupForm>(initial)
  const [errors, setErrors] = useState<Partial<Record<CupNum, string>>>({})
  const [other, setOther] = useState<null | 'drink' | 'milkType'>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const tracked = settings.tracked
  const on = (k: string) => tracked[k] !== false
  const dirty = snap(f) !== snap(initial)
  const release = useLeaveGuard(dirty, 'Bỏ thay đổi?')
  const g = groups(f)
  const nums = visibleCupNums(f, tracked)
  const photoUrl = useMemo(() => (f.photo ? URL.createObjectURL(f.photo) : null), [f.photo])
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl])

  const set = <K extends keyof CupForm>(k: K, v: CupForm[K]) => setF((x) => ({ ...x, [k]: v }))
  const setNum = (k: CupNum, v: string) => {
    const next = { ...f, vals: { ...f.vals, [k]: v } }
    setF(next)
    if (errors[k]) setErrors(errOf(next))
  }
  const errOf = (x: CupForm) => Object.fromEntries(validateCup(x, tracked).map((e) => [e.field, e.message]))
  const numRow = (k: CupNum) =>
    nums.includes(k) && (
      <NumberRow
        key={k}
        fieldId={`c-${k}`}
        label={`${CUP_NUMS[k].label} (${CUP_NUMS[k].unit})`}
        value={f.vals[k] ?? ''}
        error={errors[k]}
        onChange={(v) => setNum(k, v)}
        onBlur={() => setErrors((e) => ({ ...e, [k]: errOf(f)[k] }))}
      />
    )

  const onSave = async () => {
    const e = errOf(f)
    setErrors(e)
    if (Object.keys(e).length) return toast('Kiểm tra lại các ô báo lỗi', { tone: 'error' })
    setSaving(true)
    try {
      const r = await upsertCupByShot(db, toCupRecord(f, tracked, Date.now(), () => crypto.randomUUID(), cup))
      release()
      goBack(`/shots/${shot.id}`)
      toast(r === 'created' ? 'Đã lưu thưởng thức' : 'Đã lưu thay đổi')
    } catch (err) {
      setSaving(false)
      if (err instanceof GoneError) {
        release()
        goBack('/history')
        return toast('Shot này không còn', { tone: 'error' })
      }
      toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
    }
  }

  const milkOn = g.milk && (on('milkType') || on('foam') || nums.includes('milkMl') || nums.includes('milkTempC'))

  return (
    <div className="flex flex-col gap-5">
      <div className="stack card" style={{ gap: 4 }}>
        <div className="small muted num">Shot {hm(shot.brewedAt)} · {dayLabel(shot.brewedAt)} · {methodName(shot)}</div>
        <b className="font-normal">{bean?.name ?? '—'}</b>
        {recipe(shot) && <div className="small muted num">{recipe(shot)}</div>}
      </div>
      <p className="hint m-0">Không cần chấm hết — ghi phần nào cũng được.</p>

      {(on('drink') || on('iced')) && (
        <div className="stack" style={{ gap: 8 }}>
          <b>Đồ uống</b>
          {on('drink') && <ChoiceChips label="Kiểu uống" wrap={false} options={DRINKS} value={f.drink} onChange={(v) => v && set('drink', v)} onOther={() => setOther('drink')} />}
          {on('iced') && (
            <div className="seg" role="group" aria-label="Nóng hoặc đá">
              {(['hot', 'iced'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={f.iced === v} onClick={() => set('iced', v)}>{v === 'hot' ? 'Nóng' : 'Đá'}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        {milkOn && (
          <Group title="Sữa" defaultOpen>
            {on('milkType') && (
              <div className="stack" style={{ gap: 6 }}>
                <b className="small">Loại sữa</b>
                <ChoiceChips label="Loại sữa" options={MILKS} value={f.milkType} toggle onChange={(v) => set('milkType', v)} onOther={() => setOther('milkType')} />
              </div>
            )}
            {numRow('milkMl')}
            {numRow('milkTempC')}
            {on('foam') && (
              <div className="stack" style={{ gap: 6 }}>
                <b className="small">Độ bọt</b>
                <ChoiceChips label="Độ bọt" options={FOAMS} value={f.foam} toggle onChange={(v) => set('foam', v as CupForm['foam'])} />
              </div>
            )}
          </Group>
        )}
        {nums.includes('waterMl') && <Group title="Nước thêm" defaultOpen>{numRow('waterMl')}</Group>}
        {(nums.includes('iceG') || on('sugar')) && (
          <Group title={f.iced === 'iced' ? 'Đá & đường' : 'Đường / syrup'} defaultOpen>
            {numRow('iceG')}
            {on('sugar') && <TextField label="Đường / syrup" value={f.sugar} onChange={(v) => set('sugar', v)} list={[...SUGARS, ...used.sugars]} placeholder="VD: Đường cát, Syrup caramel" />}
            {numRow('sugarG')}
          </Group>
        )}
      </div>

      {on('rating') && (
        <div className="stack" style={{ gap: 6 }}>
          <b>Rating</b>
          <ScaleButtons label="Rating" value={f.rating} onChange={(v) => set('rating', v)} />
        </div>
      )}
      {TASTES.filter(([k]) => on(k)).map(([k, label]) => (
        <div key={k} className="stack" style={{ gap: 6 }}>
          <b className="small">{label}</b>
          <ScaleButtons small label={label} value={f[k]} onChange={(v) => set(k, v)} />
        </div>
      ))}
      {on('tasteNotes') && <TextField label="Mô tả vị" multiline value={f.tasteNotes} onChange={(v) => set('tasteNotes', v)} placeholder="VD: hoa nhài, cam, hậu vị ngọt" />}

      {on('photo') && (
        <div className="stack">
          <b className="small">Ảnh ly</b>
          {photoUrl ? (
            <>
              <img className="photo" src={photoUrl} alt="Ảnh ly" />
              <button type="button" className="btn btn-ghost" onClick={() => set('photo', null)}>Xoá ảnh</button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Chụp hoặc chọn ảnh</button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                set('photo', await resizePhoto(file))
              } catch {
                /* ảnh không đọc được — giữ nguyên, không có câu thông báo trong UC */
              }
            }}
          />
        </div>
      )}

      <SaveBar>
        <button className="btn btn-primary btn-block" disabled={saving} onClick={onSave}>
          {saving ? 'Đang lưu…' : cup ? 'Lưu thay đổi' : 'Lưu thưởng thức'}
        </button>
      </SaveBar>

      {other && (
        <AskOther
          title={other === 'drink' ? 'Kiểu uống khác' : 'Loại sữa khác'}
          suggestions={other === 'drink' ? used.drinks : used.milks}
          onDone={(v) => set(other, v)}
          onClose={() => setOther(null)}
        />
      )}
    </div>
  )
}
