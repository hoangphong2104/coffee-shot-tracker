import type { ShotForm } from '../../domain/shot'

// ADR_006 — form sống qua màn con (video, đọc đồng hồ, sửa khoảng thiết bị) trong bộ nhớ, không ghi DB.
// Khoá: 'new' hoặc id shot đang sửa. Xoá khi lưu xong hoặc người dùng chọn Bỏ.
export interface Draft { form: ShotForm; initial: string; hideReuse: boolean }

const drafts = new Map<string, Draft>()
export const getDraft = (key: string) => drafts.get(key)
export const putDraft = (key: string, d: Draft) => void drafts.set(key, d)
export const clearDraft = (key: string) => void drafts.delete(key)

/** So sánh thay đổi: bỏ qua thứ tự `touched`. */
export const snapshot = (f: ShotForm) => JSON.stringify({ ...f, touched: [...f.touched].sort() })
