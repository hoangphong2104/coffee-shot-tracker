import type { ReactNode } from 'react'
import { Check } from '../../ui/icons'

// SC_0405 / UC_0407 — hướng dẫn cài app; hình minh hoạ từng bước dạng nét vẽ (bước 4).

const isStandalone = () => matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
// iPadOS báo MacIntel + cảm ứng; Android luôn có "Android" trong user agent nên kiểm trước.
const isIos = () =>
  !/android/i.test(navigator.userAgent) && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const svg = (label: string, body: ReactNode) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label} className="flex-none text-muted">
    {body}
  </svg>
)
const Browser = svg('Trình duyệt', <><rect x="5" y="8" width="30" height="24" rx="3" /><path d="M5 14h30" /><circle cx="9" cy="11" r=".6" /></>)
const Share = svg('Nút Chia sẻ', <><rect x="12" y="16" width="16" height="16" rx="2" /><path d="M20 6v16M15 11l5-5 5 5" /></>)
const AddHome = svg('Thêm vào màn hình chính', <><rect x="10" y="10" width="20" height="20" rx="4" /><path d="M20 15v10M15 20h10" /></>)
const Done = svg('Bấm Thêm', <><rect x="6" y="13" width="28" height="14" rx="7" /><path d="M15 20l3 3 7-7" /></>)
const Menu = svg('Menu ba chấm', <><rect x="5" y="8" width="30" height="24" rx="3" /><circle cx="30" cy="13" r=".8" /><circle cx="30" cy="17" r=".8" /><circle cx="30" cy="21" r=".8" /></>)

const Steps = ({ title, steps }: { title: string; steps: [ReactNode, ReactNode][] }) => (
  <div className="card stack">
    <b className="font-normal">{title}</b>
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {steps.map(([pic, text], i) => (
        <li key={i} className="flex items-center gap-3">
          {pic}
          <span>{i + 1}. {text}</span>
        </li>
      ))}
    </ol>
  </div>
)

export function InstallPage() {
  const ios = (
    <Steps
      key="ios"
      title="iPhone / iPad (Safari)"
      steps={[
        [Browser, <>Mở link app bằng <b>Safari</b>.</>],
        [Share, <>Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên).</>],
        [AddHome, <>Chọn <b>Thêm vào MH chính</b>.</>],
        [Done, <>Bấm <b>Thêm</b>.</>],
      ]}
    />
  )
  const android = (
    <Steps
      key="android"
      title="Android (Chrome)"
      steps={[
        [Browser, <>Mở link bằng <b>Chrome</b>.</>],
        [Menu, <>Bấm <b>Cài đặt ứng dụng</b> khi trình duyệt gợi ý, hoặc menu ⋮ → <b>Thêm vào màn hình chính</b>.</>],
      ]}
    />
  )
  return (
    <>
      <div className="banner" role="status">
        {isStandalone() ? (
          <>
            <Check />
            <span>App đã được cài trên máy này</span>
          </>
        ) : (
          <span>Bạn đang mở trong trình duyệt</span>
        )}
      </div>
      {isIos() ? [ios, android] : [android, ios]}
      <div className="hint">Dữ liệu trong trình duyệt và trong app đã cài có thể là hai nơi riêng trên iPhone. Hãy ghi shot từ app đã cài.</div>
    </>
  )
}
