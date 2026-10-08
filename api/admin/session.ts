import { requireAdmin } from '../_lib/auth.js'
import { json } from '../_lib/http.js'

export async function GET(req: Request): Promise<Response> {
  return requireAdmin(req) ?? json({ ok: true })
}
