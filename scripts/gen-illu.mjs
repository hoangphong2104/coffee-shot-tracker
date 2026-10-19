// Sinh src/ui/illustrations.generated.tsx từ prototype-illustrations.js đã duyệt (SRC-011 #3, branding v2).
import fs from 'node:fs'
import vm from 'node:vm'
const [src, out] = process.argv.slice(2)
const ctx = { window: {}, Math }
vm.runInNewContext(fs.readFileSync(src, 'utf8'), ctx)
const I = ctx.window.ILLU
const body = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
const jsx = (s) =>
  s.replace(/var\(--accent\)/g, 'currentColor')
    .replace(/\s+/g, ' ')
    .replace(/ ([a-z]+)-([a-z])([a-z]*)=/g, (_, a, b, c) => ` ${a}${b.toUpperCase()}${c}=`)
    .replace(/(\d+\.\d{3})\d+/g, '$1')
    .trim()
const keys = [...I.CHOICES.map((c) => c[0]), 'burr-flat', 'burr-conical']
const BY = fs.readFileSync(src, 'utf8').match(/const BY_DEVICE = \{([\s\S]*?)\};/)[1]
let t = `// TỰ SINH từ 1.0-requirements/approved/prototypes/prototype-illustrations.js (hình nét vẽ đã duyệt — SRC-011 #3).
// Không sửa tay: node scripts/gen-illu.mjs ../../1.0-requirements/approved/prototypes/prototype-illustrations.js src/ui/illustrations.generated.tsx. Nét chung theo dáng dòng máy, không logo / chữ thương hiệu.
import type { ReactElement } from 'react'

export const ILLU: Record<string, () => ReactElement> = {
`
for (const k of keys) t += `  '${k}': () => <>${jsx(body(I.svg(k)))}</>,\n`
t += `}\n\n/** Túi hạt — độ đậm hạt theo Roast level: Light chỉ nét, Medium xám, Dark đặc (UC_0201 bước 4). */\nexport const BAG: Record<'Light' | 'Medium' | 'Dark' | 'none', () => ReactElement> = {\n`
for (const [k, r] of [['Light', 'Light'], ['Medium', 'Medium'], ['Dark', 'Dark'], ['none', undefined]]) t += `  ${k}: () => <>${jsx(body(I.svg('bag', '', { roast: r })))}</>,\n`
t += `}\n\nexport const BY_DEVICE: Record<string, string> = {${BY.trim().replace(/\n\s*/g, ' ')}}\n`
t += `export const BY_KIND: Record<string, string> = { grinder: 'g-hopper', espresso: 'e-compact', pourover: 'b-v60', aeropress: 'b-aeropress', moka: 'b-moka', frenchpress: 'b-french', other: 'b-flat' }\n`
t += `export const CHOICES: [string, string][] = ${JSON.stringify(I.CHOICES)}\n`
fs.writeFileSync(out, t)
console.log('keys', keys.length, 'bytes', t.length)
