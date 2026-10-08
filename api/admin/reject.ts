import { requireAdmin } from '../_lib/auth.js'
import { error, json, readJson } from '../_lib/http.js'
import { readSubmission, writeSubmission } from '../_lib/store.js'

export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const body = await readJson<{ id?: unknown }>(req, 4096)
  const sub = typeof body?.id === 'string' ? await readSubmission(body.id) : null
  if (!sub) return error(404, 'not found')
  const now = new Date().toISOString()
  sub.status = 'rejected'
  sub.rejectedAt = now
  sub.updatedAt = now
  delete sub.recipe
  delete sub.approvedAt
  await writeSubmission(sub)
  return json({ submission: sub })
}
