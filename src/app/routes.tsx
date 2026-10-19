import { Link, Navigate, type RouteObject } from 'react-router-dom'
import { CupFormPage } from '../features/cup/CupFormPage'
import { HomePage } from '../features/home/HomePage'
import { PlaceholderPage } from '../features/placeholder/PlaceholderPage'
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
      page('history', tabRoot(S.tabs.history)),
      page('shots/new', form(S.titles.newShot), <ShotFormPage mode="new" />),
      page('shots/new/video', form(S.titles.video)),
      page('shots/new/gauge', form(S.titles.gauge)),
      page('shots/:id', sub(S.titles.shotDetail), <ShotDetailPage />),
      page('shots/:id/edit', form(S.titles.editShot), <ShotFormPage mode="edit" />),
      page('shots/:id/edit/video', form(S.titles.video)),
      page('shots/:id/edit/gauge', form(S.titles.gauge)),
      page('shots/:id/gauge', form(S.titles.gauge)),
      page('shots/:id/cup', form(S.titles.cup), <CupFormPage />),
      page('compare', sub(S.titles.compare)),
      page('analytics', tabRoot(S.tabs.analytics)),
      page('gear', tabRoot(S.tabs.gear)),
      page('beans/new', form(S.titles.newBean)),
      page('beans/:id', form(S.titles.bean)),
      page('devices/new', form(S.titles.newDevice)),
      page('devices/:id', sub(S.titles.device)),
      page('devices/:id/edit', form(S.titles.editDevice)),
      page('settings', sub(S.settings)),
      page('settings/:section', sub(S.settings)),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
