# Shot Tracker

PWA ghi và phân tích shot cà phê. Chạy hoàn toàn trên máy — không server, không gửi dữ liệu đi đâu (SEC-001).

Đặc tả: `BA-Workspace/1.0-requirements/approved` (baseline Requirement v2) và `BA-Workspace/2.0-design/approved` (System Design v1). Code theo UC / AC, không theo prototype (điều kiện C-2).

## Chạy

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest + fake-indexeddb
npm run lint
npm run build     # dist/ — có CSP và service worker
npm run preview   # chạy thử bản build
```

## Phát hành (NFR_009)

GitHub Actions (`.github/workflows/ci.yml`): lint → test → build → Lighthouse mobile (Performance ≥ 90, chặn nếu thấp hơn) → deploy GitHub Pages khi đẩy lên `main`. Base path tương đối (`./`) nên chạy dưới bất kỳ tên repo nào. Cần bật **Settings → Pages → Source: GitHub Actions** một lần.

Icon PNG sinh từ thiết kế đã duyệt: `node scripts/gen-icons.mjs`. Hình nét vẽ: `node scripts/gen-illu.mjs …` (xem đầu file).

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| `src/app` | khởi động (UC_0901), router, App |
| `src/data` | Dexie schema (TBL-001..009), kiểu dữ liệu, seed 49 thiết bị |
| `src/domain` | luật nghiệp vụ thuần — không import React / Dexie (chặn bằng ESLint) |
| `src/features` | màn hình theo FE_MOD |
| `src/ui` | khung, toast, hộp xác nhận, màn lỗi |
| `src/strings.vi.ts` | mọi chuỗi giao diện, lấy nguyên văn từ UC |

## Quy tắc

- Không dùng `dangerouslySetInnerHTML` (SEC-008 / SEC-009 — ESLint chặn).
- Dữ liệu trong test và ví dụ là dữ liệu giả (SEC-011). Không commit video thật.
