import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// jsdom không có scrollIntoView (UC_0103 bước 17 cuộn tới lỗi đầu).
Element.prototype.scrollIntoView = () => {}
// jsdom không có scrollTo (ScrollRestoration, Lịch sử giữ vị trí cuộn).
window.scrollTo = () => {}
