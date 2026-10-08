import { requireAdmin } from '../_lib/auth.js'
import { error, json, readJson } from '../_lib/http.js'
import { cleanCuisine, cleanDraft, isGroup } from '../_lib/recipe.js'
import { deleteSubmission, readSubmission, writeSubmission } from '../_lib/store.js'

function idFrom(req: Request): string {
  return new URL(req.url).searchParams.get('id') ?? ''
}

export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const sub = await readSubmission(idFrom(req))
  return sub ? json({ submission: sub }) : error(404, 'not found')
}

/** Update draft fields and/or group/cuisine. */
export async function PATCH(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const sub = await readSubmission(idFrom(req))
  if (!sub) return error(404, 'not found')
  const body = await readJson<{ draft?: unknown; group?: unknown; cuisine?: unknown }>(req, 200 * 1024)
  if (!body) return error(400, 'bad request')
  if (body.draft !== undefined) sub.draft = cleanDraft(body.draft)
  if (isGroup(body.group)) sub.draft.group = body.group
  if (body.cuisine !== undefined) sub.cuisine = cleanCuisine(body.cuisine)
  sub.updatedAt = new Date().toISOString()
  await writeSubmission(sub)
  return json({ submission: sub })
}

/** Permanently delete a submission and its photos. */
export async function DELETE(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const sub = await readSubmission(idFrom(req))
  if (!sub) return error(404, 'not found')
  await deleteSubmission(sub)
  return json({ ok: true })
}
