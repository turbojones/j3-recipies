import { clearSessionCookie } from '../_lib/auth.js'
import { json } from '../_lib/http.js'

export async function POST(): Promise<Response> {
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() })
}
