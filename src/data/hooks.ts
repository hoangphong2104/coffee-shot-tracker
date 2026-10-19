import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { activeBeansByRecentUse } from './repos'

// Đọc sống qua Dexie: màn quay về tự vẽ lại theo dữ liệu mới (UC_0001 bước 5, UC_0106 bước 5).
export const useSettings = () => useLiveQuery(() => db.settings.get('main'), [])
export const useDevices = () => useLiveQuery(() => db.devices.toArray(), [])
export const useBeans = () => useLiveQuery(() => db.beans.toArray(), [])
export const useActiveBeans = () => useLiveQuery(() => activeBeansByRecentUse(db), [])
