import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { clientIp, error, json, readJson, throttle } from './_lib/http.js'
import { ALLOWED_TYPES, LIMITS } from './_lib/recipe.js'

// Client pathnames before Blob adds its random suffix.
const CLIENT_PATH_RE = /^uploads\/[a-f0-9]{32}\/[0-9]{1,2}-[a-z0-9-]{1,40}\.(jpg|jpeg|png|webp|gif|heic|heif|pdf)$/

/** Issues short-lived client upload tokens for submission photos (private Blob). */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson<HandleUploadBody>(req, 16 * 1024)
  if (!body || body.type !== 'blob.generate-client-token') return error(400, 'bad request')
  const ip = clientIp(req)
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!CLIENT_PATH_RE.test(pathname)) throw new Error('bad path')
        if (!throttle(`upload:${ip}`, 40, 15 * 60_000)) throw new Error('throttled')
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: LIMITS.photoBytes,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60_000,
        }
      },
    })
    return json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return error(msg === 'throttled' ? 429 : 400, msg === 'throttled' ? 'Too many uploads. Try again later.' : 'Upload not allowed.')
  }
}
