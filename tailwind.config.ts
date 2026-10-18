import type { Config } from 'tailwindcss'

// Design system SD-01B §2 — màu lấy từ CSS variables (branding v2, đơn sắc + đỏ cho lỗi).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface2: 'var(--surface-2)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        line: 'var(--line)',
        error: 'var(--error)',
      },
      fontFamily: { sans: ['"Be Vietnam Pro"', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'system-ui', 'sans-serif'] },
      maxWidth: { app: '480px' },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [],
} satisfies Config
