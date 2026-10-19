import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { confirmText, NOT_BACKUP, parseBackup, planImport, resultText } from '../../domain/backup'
import { useFeedback } from '../../ui/feedback'
import { Check } from '../../ui/icons'
import { PRIVACY } from '../settings/SettingsPages'
import { applyImport, existingIds, exportCsvFile, exportJsonFile, shareFile, videoUsage } from './io'

// SC_0404 — UC_0405 xuất JSON / CSV, UC_0406 nhập JSON gộp (INT-001).

export function BackupPage() {
  const { toast, confirm } = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const stats = useLiveQuery(async () => {
    const [shots, beans, custom, video] = await Promise.all([
      db.shots.count(), db.beans.count(), db.devices.filter((d) => !d.builtin).count(), videoUsage(db),
    ])
    return { shots, beans, custom, video }
  }, [])
  if (!stats) return null

  const doExport = async (kind: 'json' | 'csv') => {
    if (!(await db.shots.count())) return toast('Chưa có gì để xuất') // kiểm lại khi bấm (bước 2)
    setBusy(true)
    try {
      await shareFile(kind === 'json' ? await exportJsonFile(db) : await exportCsvFile(db))
    } catch {
      toast('Không xuất được file. Thử lại', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file: File) => {
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) return toast(NOT_BACKUP, { tone: 'error' })
    const plan = planImport(parsed.data, await existingIds(db), Date.now())
    if (!(await confirm({ title: 'Nhập dữ liệu?', body: confirmText(plan), ok: 'Nhập' }))) return
    setBusy(true)
    try {
      await applyImport(db, plan)
      setResult(resultText(plan))
    } catch {
      toast('Không lưu được trên máy này. Kiểm tra dung lượng trống', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const has = stats.shots > 0
  return (
    <>
      <div className="card">
        <b className="font-normal">Dữ liệu trên máy này</b>
        <div className="muted num">{stats.shots} shot · {stats.beans} hạt · {stats.custom} thiết bị custom</div>
        <div className="muted num">Video: {stats.video.count} file · {stats.video.mb} MB / 2048 MB</div>
      </div>

      <h2 className="section-title m-0">Xuất</h2>
      <button className="btn btn-primary btn-block" disabled={!has || busy} onClick={() => doExport('json')}>Xuất JSON (sao lưu đầy đủ)</button>
      <button className="btn btn-ghost btn-block" disabled={!has || busy} onClick={() => doExport('csv')}>Xuất CSV (mở bằng Excel)</button>
      {!has && <div className="small muted">Chưa có gì để xuất</div>}
      <div className="hint">Dữ liệu chỉ nằm trên máy này. Xuất JSON định kỳ để không mất lịch sử.</div>
      <div className="hint">File JSON có đường áp suất nhưng không có file video (quá nặng). Tải video từng shot ở Chi tiết shot.</div>
      <div className="hint">{PRIVACY}</div>

      <h2 className="section-title m-0">Nhập</h2>
      <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => fileRef.current?.click()}>Nhập từ file JSON</button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void doImport(f)
        }}
      />
      <div aria-live="polite">
        {result && (
          <div className="banner">
            <Check />
            <span>{result}</span>
          </div>
        )}
      </div>
    </>
  )
}
