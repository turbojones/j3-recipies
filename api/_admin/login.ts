import { createSessionCookie, passcodeMatches } from '../_lib/auth.js'
import { clientIp, countRecent, error, json, readJson, record, sleep } from '../_lib/http.js'

const WINDOW = 15 * 60_000
const MAX_FAILS = 8

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req)
  const key = `loginfail:${ip}`
  if (countRecent(key, WINDOW) >= MAX_FAILS) {
    await sleep(1000)
    return error(429, 'Too many attempts. Try again later.')
  }
  const body = await readJson<{ passcode?: unknown }>(req, 2048)
  const passcode = typeof body?.passcode === 'string' ? body.passcode : ''
  if (!passcode || !passcodeMatches(passcode)) {
    record(key)
    await sleep(1200)
    return error(401, 'Wrong passcode.')
  }
  const cookie = createSessionCookie()
  if (!cookie) return error(500, 'Server not configured.')
  return json({ ok: true }, 200, { 'set-cookie': cookie })
}
