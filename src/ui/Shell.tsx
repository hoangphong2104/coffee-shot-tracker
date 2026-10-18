import { NavLink, Outlet, useMatches, useNavigate } from 'react-router-dom'
import { S } from '../strings.vi'

// FE_MOD_001 / SC_0000 v2.0 — header chữ hoa căn giữa; thanh tab bằng chữ, nút ＋ tròn ở giữa (ẩn trên màn form).

export interface RouteHandle {
  title: string
  tabRoot?: boolean
  hideTabs?: boolean
  actions?: () => JSX.Element
}

const Plus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
    <path d="M12 4v16M4 12h16" />
  </svg>
)
const Back = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export function Shell() {
  const matches = useMatches()
  const navigate = useNavigate()
  const handle = (matches[matches.length - 1]?.handle ?? { title: S.appName }) as RouteHandle

  return (
    <div className="mx-auto min-h-full max-w-app bg-bg">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 grid min-h-14 grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)] items-center gap-1 bg-bg px-2 py-2">
        <div className="justify-self-start">
          {!handle.tabRoot && (
            <button className="grid h-11 w-11 place-items-center rounded-full" aria-label={S.back} onClick={() => navigate(-1)}>
              <Back />
            </button>
          )}
        </div>
        <h1 className="caps m-0 max-w-[56vw] truncate text-center text-xs">{handle.title}</h1>
        <div className="flex items-center justify-self-end">{handle.actions?.()}</div>
      </header>
      <main className={`flex flex-col gap-5 px-5 pt-2 ${handle.hideTabs ? 'pb-[calc(120px+env(safe-area-inset-bottom))]' : 'pb-[calc(110px+env(safe-area-inset-bottom))]'}`}>
        <Outlet />
      </main>
      {!handle.hideTabs && <TabBar />}
    </div>
  )
}

function TabBar() {
  const tab = (to: string, label: string) => (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-tap items-center justify-center whitespace-nowrap text-[11px] uppercase tracking-[0.1em] ${
          isActive ? 'font-medium text-fg underline decoration-1 underline-offset-[6px]' : 'font-light text-muted'
        }`
      }
    >
      {label}
    </NavLink>
  )
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-app -translate-x-1/2 grid-cols-[repeat(2,minmax(0,1fr))_auto_repeat(2,minmax(0,1fr))] items-center bg-bg px-1 pb-[calc(14px+env(safe-area-inset-bottom))] pt-2"
    >
      {tab('/', S.tabs.home)}
      {tab('/history', S.tabs.history)}
      <NavLink to="/shots/new" aria-label={S.tabs.newShot} className="grid place-items-center px-1">
        <span className="grid h-[52px] w-[52px] place-items-center rounded-full border border-fg">
          <Plus />
        </span>
      </NavLink>
      {tab('/analytics', S.tabs.analytics)}
      {tab('/gear', S.tabs.gear)}
    </nav>
  )
}
