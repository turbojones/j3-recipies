import { requireAdmin } from '../_lib/auth.js'
import { error } from '../_lib/http.js'
import { UPLOAD_PATH_RE } from '../_lib/recipe.js'
import { openStream } from '../_lib/store.js'

/** Streams a private submission photo to the signed-in admin. */
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req)
  if (denied) return denied
  const path = new URL(req.url).searchParams.get('path') ?? ''
  if (!UPLOAD_PATH_RE.test(path)) return error(400, 'bad path')
  const res = await openStream(path)
  if (!res) return error(404, 'not found')
  return new Response(res.stream, {
    headers: {
      'content-type': res.blob.contentType,
      'cache-control': 'private, max-age=3600',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  })
}
