import { extractDraft } from './_lib/extract.js'
import { clientIp, error, json, readJson, throttle } from './_lib/http.js'
import { cleanDraft, LIMITS, UPLOAD_PATH_RE } from './_lib/recipe.js'
import { readBytes } from './_lib/store.js'

/** Reads uploaded recipe photos/PDF (in page order) and returns a draft for the submit form. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson<{ photos?: unknown }>(req, 16 * 1024)
  const photos = Array.isArray(body?.photos) ? body.photos : []
  if (
    photos.length < 1 ||
    photos.length > LIMITS.photos ||
    !photos.every((p): p is string => typeof p === 'string' && UPLOAD_PATH_RE.test(p))
  ) {
    return error(400, 'bad request')
  }
  if (!throttle(`autofill:${clientIp(req)}`, 12, 15 * 60_000)) {
    return error(429, 'Too many requests. Try again later.')
  }

  const pages = []
  for (const p of photos) {
    const file = await readBytes(p)
    if (!file) return error(404, 'photo not found')
    if (file.bytes.byteLength > LIMITS.photoBytes) return error(413, 'photo too large')
    pages.push({ bytes: file.bytes, mediaType: file.contentType })
  }

  try {
    const raw = await extractDraft(pages)
    const draft = cleanDraft(raw)
    return json({ draft })
  } catch (e) {
    console.error('autofill failed', e instanceof Error ? `${e.name}: ${e.message}` : e)
    return error(503, 'autofill_unavailable')
  }
}
