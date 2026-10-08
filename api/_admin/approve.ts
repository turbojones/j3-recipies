import { requireAdmin } from '../_lib/auth.js'
import { error, json, readJson } from '../_lib/http.js'
import { cleanCuisine, cleanDraft, draftProblem, isGroup, toRecipe } from '../_lib/recipe.js'
import { readSubmission, writeSubmission } from '../_lib/store.js'

/** Approve (hand-off): stores the final Recipe JSON; does NOT publish. */
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const body = await readJson<{ id?: unknown; draft?: unknown; group?: unknown; cuisine?: unknown }>(req, 200 * 1024)
  const sub = typeof body?.id === 'string' ? await readSubmission(body.id) : null
  if (!sub) return error(404, 'not found')
  if (body?.draft !== undefined) sub.draft = cleanDraft(body.draft)
  if (isGroup(body?.group)) sub.draft.group = body.group
  if (body?.cuisine !== undefined) sub.cuisine = cleanCuisine(body.cuisine)
  const incomplete = draftProblem(sub.draft) !== null || !sub.draft.cookTimeMinutes || !sub.draft.servings
  const now = new Date().toISOString()
  if (incomplete && sub.source === 'upload' && sub.photos.length > 0) {
    // Photo-only submission: approve as-is; Chef types it up from the photos.
    if (!sub.draft.title) return error(400, 'Recipe name is required.')
    sub.needsTranscription = true
    delete sub.recipe
  } else {
    const problem = draftProblem(sub.draft)
    if (problem) return error(400, problem)
    if (!sub.draft.cookTimeMinutes || !sub.draft.servings) {
      return error(400, 'Cook time and servings are needed before approving.')
    }
    sub.needsTranscription = false
    sub.recipe = toRecipe(sub.draft, sub.cuisine)
  }
  sub.status = 'approved'
  sub.approvedAt = now
  sub.updatedAt = now
  delete sub.rejectedAt
  await writeSubmission(sub)
  return json({ submission: sub })
}
