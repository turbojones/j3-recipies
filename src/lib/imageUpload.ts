import { upload } from '@vercel/blob/client'

export const MAX_PHOTOS = 10
export const MAX_BYTES = 10 * 1024 * 1024

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

export function isAllowedType(type: string): boolean {
  return type in EXT
}

export function randomHex(bytes = 16): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Downscale large photos to ~2000px JPEG so uploads and auto-fill stay fast. */
export async function compressImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const max = 2000
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type === 'image/jpeg') {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/** Uploads one file privately to Vercel Blob; returns its pathname. */
export async function uploadPhoto(dir: string, index: number, blob: Blob): Promise<string> {
  const type = blob.type || 'image/jpeg'
  const ext = EXT[type] ?? 'jpg'
  const base = type === 'application/pdf' ? 'recipe' : 'page'
  const result = await upload(`uploads/${dir}/${index % 100}-${base}.${ext}`, blob, {
    access: 'private',
    handleUploadUrl: '/api/upload',
    contentType: type,
  })
  return result.pathname
}
