import { clientIp, error, json, readJson, throttle } from './_lib/http.js'
import {
  ALLOWED_TYPES,
  cleanCuisine,
  cleanDraft,
  cleanName,
  draftProblem,
  LIMITS,
  UPLOAD_PATH_RE,
  type Photo,
  type Submission,
} from './_lib/recipe.js'
import { blobInfo, newId, writeSubmission } from './_lib/store.js'

type Body = {
  name?: unknown
  website?: unknown // honeypot
  draft?: unknown
  photos?: unknown
  autofilled?: unknown
}

/** Public: create a pending submission. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson<Body>(req, 200 * 1024)
  if (!body) return error(400, 'Invalid request.')

  // Honeypot: pretend success, store nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true, id: 'thanks' })
  }

  const name = cleanName(body.name)
  if (!name) return error(400, 'Your name is required.')
  const draft = cleanDraft(body.draft)
  const problem = draftProblem(draft)
  if (problem) return error(400, problem)

  const rawPhotos = Array.isArray(body.photos) ? body.photos : []
  if (rawPhotos.length > LIMITS.photos) return error(400, `Up to ${LIMITS.photos} photos.`)
  if (!rawPhotos.every((p): p is string => typeof p === 'string' && UPLOAD_PATH_RE.test(p))) {
    return error(400, 'Invalid photo.')
  }
  if (new Set(rawPhotos).size !== rawPhotos.length) return error(400, 'Duplicate photo.')

  if (!throttle(`submit:${clientIp(req)}`, 6, 30 * 60_000)) {
    return error(429, 'Too many submissions. Try again later.')
  }

  const photos: Photo[] = []
  for (const pathname of rawPhotos) {
    const info = await blobInfo(pathname)
    if (!info) return error(400, 'A photo is missing. Please re-add it.')
    if (!ALLOWED_TYPES.includes(info.contentType) || info.size > LIMITS.photoBytes) {
      return error(400, 'Photos must be images or a PDF under 10 MB.')
    }
    photos.push({ pathname, contentType: info.contentType, size: info.size })
  }

  const now = new Date().toISOString()
  const sub: Submission = {
    id: newId(),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    submitterName: name,
    source: photos.length > 0 ? 'upload' : 'typed',
    photos,
    draft,
    cuisine: cleanCuisine(undefined),
    autofilled: body.autofilled === true,
  }
  await writeSubmission(sub)
  return json({ ok: true, id: sub.id }, 201)
}
