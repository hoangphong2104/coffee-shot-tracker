import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { activeBeansByRecentUse } from './repos'
import { shotViews } from '../domain/view'

// Đọc sống qua Dexie: màn quay về tự vẽ lại theo dữ liệu mới (UC_0001 bước 5, UC_0106 bước 5).
export const useSettings = () => useLiveQuery(() => db.settings.get('main'), [])
export const useDevices = () => useLiveQuery(() => db.devices.toArray(), [])
export const useBeans = () => useLiveQuery(() => db.beans.toArray(), [])
export const useActiveBeans = () => useLiveQuery(() => activeBeansByRecentUse(db), [])

/** Shot + ly, mới nhất trước (BR-12). Lịch sử ≤ 5.000 shot lọc trong bộ nhớ (NFR_004). */
export const useShotViews = () =>
  useLiveQuery(async () => {
    const [shots, cups] = await Promise.all([db.shots.toArray(), db.cups.toArray()])
    return shotViews(shots, cups)
  }, [])
export const useCups = () => useLiveQuery(() => db.cups.toArray(), [])
