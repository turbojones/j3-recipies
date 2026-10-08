import { requireAdmin } from '../_lib/auth.js'
import { json } from '../_lib/http.js'
import { listSubmissions } from '../_lib/store.js'

/** Approved recipes not yet added to src/data/recipes.ts (oldest first). */
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const subs = (await listSubmissions())
    .filter((s) => s.status === 'approved' && (s.recipe || s.needsTranscription))
    .reverse()
  return json({
    count: subs.length,
    items: subs.map((s) => ({
      submissionId: s.id,
      submitterName: s.submitterName,
      approvedAt: s.approvedAt,
      recipe: s.recipe ?? null,
      needsTranscription: s.needsTranscription === true,
      title: s.draft.title,
      group: s.draft.group,
      description: s.description ?? '',
      photos: s.photos.map((p) => p.pathname),
    })),
  })
}
