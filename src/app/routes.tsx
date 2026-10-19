import { lazy, Suspense } from 'react'
import { Link, Navigate, type RouteObject } from 'react-router-dom'
import { BackupPage } from '../features/backup/BackupPage'
import { BeanPage } from '../features/beans/BeanPage'
import { ComparePage } from '../features/compare/ComparePage'
import { CupFormPage } from '../features/cup/CupFormPage'
import { DeviceDetailPage } from '../features/gear/DeviceDetailPage'
import { DeviceFormPage } from '../features/gear/DeviceFormPage'
import { GearPage } from '../features/gear/GearPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { HomePage } from '../features/home/HomePage'
import { PlaceholderPage } from '../features/placeholder/PlaceholderPage'
import { DefaultsPage } from '../features/settings/DefaultsPage'
import { InstallPage } from '../features/settings/InstallPage'
import { GeneralSettingsPage, SettingsPage, TrackedPage } from '../features/settings/SettingsPages'
import { ShotDetailPage } from '../features/shot/ShotDetailPage'
import { ShotFormPage } from '../features/shot/ShotFormPage'
import { ErrorScreen } from '../ui/ErrorScreen'
import { Shell, type RouteHandle } from '../ui/Shell'
import { S } from '../strings.vi'

// platform-ui §3 — bảng route (hash). Màn chưa làm trỏ tới PlaceholderPage, thay dần theo CODE-002..007.

const Gear = () => (
  <Link to="/settings" aria-label={S.settings} className="grid h-11 w-11 place-items-center rounded-full">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </svg>
  </Link>
)

// ADR_005 — Recharts chỉ tải khi mở tab Biểu đồ
const AnalyticsPage = lazy(() => import('../features/analytics/AnalyticsPage'))

const page = (path: string, handle: RouteHandle, element = <PlaceholderPage />): RouteObject => ({ path, handle, element })
const tabRoot = (title: string): RouteHandle => ({ title, tabRoot: true })
const form = (title: string): RouteHandle => ({ title, hideTabs: true })
const sub = (title: string): RouteHandle => ({ title })

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    // NFR_011 — lỗi khi vẽ một màn → màn lỗi của app (không phải trang lỗi mặc định của router)
    errorElement: <ErrorScreen message={S.crashTitle} actionLabel={S.reload} onAction={() => location.reload()} />,
    children: [
      { index: true, handle: { title: S.appName, tabRoot: true, actions: Gear } satisfies RouteHandle, element: <HomePage /> },
      page('history', tabRoot(S.tabs.history), <HistoryPage />),
      page('shots/new', form(S.titles.newShot), <ShotFormPage mode="new" />),
      page('shots/new/video', form(S.titles.video)),
      page('shots/new/gauge', form(S.titles.gauge)),
      page('shots/:id', sub(S.titles.shotDetail), <ShotDetailPage />),
      page('shots/:id/edit', form(S.titles.editShot), <ShotFormPage mode="edit" />),
      page('shots/:id/edit/video', form(S.titles.video)),
      page('shots/:id/edit/gauge', form(S.titles.gauge)),
      page('shots/:id/gauge', form(S.titles.gauge)),
      page('shots/:id/cup', form(S.titles.cup), <CupFormPage />),
      page('compare', sub(S.titles.compare), <ComparePage />),
      page('analytics', tabRoot(S.titles.analytics), <Suspense fallback={null}><AnalyticsPage /></Suspense>),
      page('gear', tabRoot(S.tabs.gear), <GearPage />),
      page('beans/new', form(S.titles.newBean), <BeanPage mode="new" />),
      page('beans/:id', form(S.titles.bean), <BeanPage mode="edit" />),
      page('devices/new', form(S.titles.newDevice), <DeviceFormPage mode="new" />),
      page('devices/:id', sub(S.titles.device), <DeviceDetailPage />),
      page('devices/:id/edit', form(S.titles.editDevice), <DeviceFormPage mode="edit" />),
      page('settings', sub(S.settings), <SettingsPage />),
      page('settings/general', sub(S.titles.general), <GeneralSettingsPage />),
      page('settings/tracked', sub(S.titles.tracked), <TrackedPage />),
      page('settings/defaults', form(S.titles.defaults), <DefaultsPage />),
      page('settings/backup', sub(S.titles.backup), <BackupPage />),
      page('settings/install', sub(S.titles.install), <InstallPage />),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
