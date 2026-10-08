import { requireAdmin } from '../_lib/auth.js'
import { error, json } from '../_lib/http.js'
import { listSubmissions } from '../_lib/store.js'

const FILTERS: Record<string, string[]> = {
  pending: ['pending'],
  approved: ['approved', 'added'],
  rejected: ['rejected'],
  added: ['added'],
  all: ['pending', 'approved', 'rejected', 'added'],
}

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const status = new URL(req.url).searchParams.get('status') ?? 'pending'
  const allowed = FILTERS[status]
  if (!allowed) return error(400, 'bad status')
  const subs = await listSubmissions()
  const items = subs
    .filter((s) => allowed.includes(s.status))
    .map((s) => ({
      id: s.id,
      status: s.status,
      title: s.draft.title,
      group: s.draft.group,
      submitterName: s.submitterName,
      createdAt: s.createdAt,
      photoCount: s.photos.length,
      thumb: s.photos.find((p) => p.contentType.startsWith('image/'))?.pathname ?? null,
      hasPdf: s.photos.some((p) => p.contentType === 'application/pdf'),
    }))
  return json({ items })
}
