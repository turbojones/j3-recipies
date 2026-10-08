import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { error } from './http.js'

export const SESSION_COOKIE = 'j3_admin'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const COOKIE_PATH = '/api/admin'

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET?.trim()
  return s && s.length >= 32 ? s : null
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so lengths always match and nothing leaks via early exit.
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function passcodeMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSCODE?.trim()
  if (!expected) return false
  return safeEqual(input.trim(), expected)
}

export function createSessionCookie(): string | null {
  const key = secret()
  if (!key) return null
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  const payload = `v1.${exp}.${randomBytes(12).toString('base64url')}`
  const value = `${payload}.${sign(payload, key)}`
  return `${SESSION_COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim()
  }
  return null
}

export function hasValidSession(req: Request): boolean {
  const key = secret()
  if (!key) return false
  const raw = readCookie(req, SESSION_COOKIE)
  if (!raw) return false
  const parts = raw.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return false
  const payload = parts.slice(0, 3).join('.')
  if (!safeEqual(sign(payload, key), parts[3])) return false
  const exp = Number(parts[1])
  return Number.isFinite(exp) && exp > Date.now() / 1000
}

/** Returns a 401 Response when the request is not an authenticated admin; null when OK. */
export function requireAdmin(req: Request): Response | null {
  return hasValidSession(req) ? null : error(401, 'unauthorized')
}
