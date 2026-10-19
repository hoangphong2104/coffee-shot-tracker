// MOD_002 resizePhoto — UC_0114 bước 8, SEC-004, NFR_004.
// Vẽ lại qua canvas: cạnh dài tối đa 720 px, JPEG — mã hoá lại nên bỏ EXIF / GPS.

const MAX = 720
const LIMIT = 300 * 1024

export async function resizePhoto(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  const encode = (q: number) => new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('encode'))), 'image/jpeg', q))
  const blob = await encode(0.78)
  return blob.size > LIMIT ? encode(0.65) : blob
}
