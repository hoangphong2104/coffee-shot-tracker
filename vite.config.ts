/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ADR_010 / SEC-001 / SEC-010: chỉ tài nguyên của chính app; ảnh / video từ data: và blob:.
// Chỉ chèn khi build — ở dev, Vite cần script inline (React Refresh) và WebSocket cho HMR.
const CSP =
  "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; " +
  "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; " +
  "object-src 'none'; base-uri 'self'; form-action 'none'"

const csp = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
})

// ADR_001 / ADR_004: SPA tĩnh, hash router → base tương đối chạy được dưới mọi đường dẫn GitHub Pages.
// ADR_009: precache toàn bộ asset; người dùng tự bấm "Tải lại" khi có bản mới (registerType: 'prompt').
export default defineConfig({
  base: './',
  plugins: [
    react(),
    csp(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Coffee Shot Tracker',
        short_name: 'Shot Tracker',
        description: 'Ghi và phân tích shot cà phê',
        lang: 'vi',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,json}'] },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
