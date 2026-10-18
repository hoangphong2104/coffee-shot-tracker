import Dexie, { type EntityTable } from 'dexie'
import type { Bean, Cup, Device, Meta, Settings, Shot, Video, VideoBlob } from './types'

// MOD_004 — schema theo database-design-v1 (TBL-001..TBL-009).
// `&shotId` ở cups / videos giữ quy tắc 1 shot – 0..1 ly / video ngay ở tầng dữ liệu (BR-12, BR-13).
export class ShotTrackerDB extends Dexie {
  beans!: EntityTable<Bean, 'id'>
  shots!: EntityTable<Shot, 'id'>
  devices!: EntityTable<Device, 'id'>
  settings!: EntityTable<Settings, 'id'>
  cups!: EntityTable<Cup, 'id'>
  videos!: EntityTable<Video, 'id'>
  videoBlobs!: EntityTable<VideoBlob, 'videoId'>
  meta!: EntityTable<Meta, 'key'>

  constructor(name = 'shot-tracker') {
    super(name)
    this.version(1).stores({
      beans: 'id, status, updatedAt',
      shots: 'id, brewedAt, beanId, method, grinderId, [method+brewedAt]',
      // `builtin` là boolean — IndexedDB không index được boolean (drift DR-02 so với TBL-003); lọc trong bộ nhớ (~50 bản ghi).
      devices: 'id, kind, status',
      settings: 'id',
      cups: 'id, &shotId, cuppedAt',
      videos: 'id, &shotId',
      videoBlobs: 'videoId',
      meta: 'key',
    })
  }
}

export const db = new ShotTrackerDB()
