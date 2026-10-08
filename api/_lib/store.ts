import { randomBytes } from 'node:crypto'
import { del, get, head, list, put } from '@vercel/blob'
import type { Submission } from './recipe.js'
import { ID_RE } from './recipe.js'

const PREFIX = 'submissions/'

export function newId(): string {
  return `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`
}

function pathFor(id: string): string {
  return `${PREFIX}${id}.json`
}

export async function readBytes(pathname: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const res = await get(pathname, { access: 'private', useCache: false })
  if (!res || res.statusCode !== 200) return null
  const buf = new Uint8Array(await new Response(res.stream).arrayBuffer())
  return { bytes: buf, contentType: res.blob.contentType }
}

export async function openStream(pathname: string) {
  const res = await get(pathname, { access: 'private' })
  if (!res || res.statusCode !== 200) return null
  return res
}

export async function blobInfo(pathname: string): Promise<{ contentType: string; size: number } | null> {
  try {
    const h = await head(pathname)
    return { contentType: h.contentType, size: h.size }
  } catch {
    return null
  }
}

export async function readSubmission(id: string): Promise<Submission | null> {
  if (!ID_RE.test(id)) return null
  const res = await readBytes(pathFor(id))
  if (!res) return null
  try {
    return JSON.parse(new TextDecoder().decode(res.bytes)) as Submission
  } catch {
    return null
  }
}

export async function writeSubmission(sub: Submission): Promise<void> {
  await put(pathFor(sub.id), JSON.stringify(sub, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  })
}

export async function listSubmissions(): Promise<Submission[]> {
  const ids: string[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 })
    for (const b of page.blobs) {
      const m = /^submissions\/(.+)\.json$/.exec(b.pathname)
      if (m && ID_RE.test(m[1])) ids.push(m[1])
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  const out: Submission[] = []
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(ids.slice(i, i + 10).map((id) => readSubmission(id)))
    for (const s of batch) if (s) out.push(s)
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteSubmission(sub: Submission): Promise<void> {
  const paths = [pathFor(sub.id), ...sub.photos.map((p) => p.pathname)]
  await del(paths)
}
