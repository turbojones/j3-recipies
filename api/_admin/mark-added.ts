import { requireAdmin } from '../_lib/auth.js'
import { error, json, readJson } from '../_lib/http.js'
import { readSubmission, writeSubmission } from '../_lib/store.js'

/** Mark approved submissions as added to recipes.ts. Body: { ids: string[] } */
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const body = await readJson<{ ids?: unknown }>(req, 16 * 1024)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
  if (ids.length === 0 || ids.length > 100) return error(400, 'ids required')
  const updated: string[] = []
  const skipped: string[] = []
  for (const id of ids) {
    const sub = await readSubmission(id)
    if (!sub || sub.status !== 'approved') {
      skipped.push(id)
      continue
    }
    const now = new Date().toISOString()
    sub.status = 'added'
    sub.addedAt = now
    sub.updatedAt = now
    await writeSubmission(sub)
    updated.push(id)
  }
  return json({ updated, skipped })
}
