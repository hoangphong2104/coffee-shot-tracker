// Sinh icon PNG từ public/icon.svg (2 vòng tròn đơn sắc — branding v2) — không cần thư viện ngoài.
// iOS cần PNG cho màn hình chính (TD-04); Android / Lighthouse cần 192 + 512 (any + maskable).
// Vòng ngoài r = 150/512 nằm trong vùng an toàn maskable (r ≤ 0.4 × 512) nên dùng chung một hình.
// Chạy: node scripts/gen-icons.mjs
import fs from 'node:fs'
import zlib from 'node:zlib'

const BG = [0xff, 0xff, 0xff]
const FG = [0x1a, 0x1a, 0x1a]
const RINGS = [{ r: 150, w: 10 }, { r: 96, w: 6 }] // theo viewBox 512

function render(size) {
  const ss = 4 // khử răng cưa: lấy mẫu 4 × 4 mỗi điểm ảnh
  const k = size / 512
  const px = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let hit = 0
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const d = Math.hypot((x + (sx + 0.5) / ss) / k - 256, (y + (sy + 0.5) / ss) / k - 256)
          if (RINGS.some(({ r, w }) => Math.abs(d - r) <= w / 2)) hit++
        }
      const a = hit / (ss * ss)
      for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = Math.round(BG[c] * (1 - a) + FG[c] * a)
    }
  return png(size, px)
}

function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2 // RGB 8-bit
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(`public/${name}`, render(size))
  console.log(name, size)
}
