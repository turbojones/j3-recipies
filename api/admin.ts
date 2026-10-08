import * as approve from './_admin/approve.js'
import * as approvedExport from './_admin/approved-export.js'
import * as list from './_admin/list.js'
import * as login from './_admin/login.js'
import * as logout from './_admin/logout.js'
import * as markAdded from './_admin/mark-added.js'
import * as photo from './_admin/photo.js'
import * as reject from './_admin/reject.js'
import * as session from './_admin/session.js'
import * as submission from './_admin/submission.js'
import { error } from './_lib/http.js'

type Handler = (req: Request) => Promise<Response>
type Module = Partial<Record<'GET' | 'POST' | 'PATCH' | 'DELETE', Handler>>

// One function for every /api/admin/* route (keeps us under the Hobby function limit).
// vercel.json rewrites /api/admin/:route to /api/admin?route=:route.
// Each route module verifies the admin session cookie itself (except login).
const ROUTES: Record<string, Module> = {
  login,
  logout,
  session,
  list,
  submission,
  approve,
  reject,
  'approved-export': approvedExport,
  'mark-added': markAdded,
  photo,
}

function routeOf(req: Request): string {
  const url = new URL(req.url)
  const m = /^\/api\/admin\/([a-z-]+)\/?$/.exec(url.pathname)
  return m?.[1] ?? url.searchParams.get('route') ?? ''
}

async function dispatch(req: Request): Promise<Response> {
  const mod = Object.hasOwn(ROUTES, routeOf(req)) ? ROUTES[routeOf(req)] : undefined
  if (!mod) return error(404, 'not found')
  const handler = mod[req.method as keyof Module]
  if (!handler) return error(405, 'method not allowed')
  return handler(req)
}

export const GET = dispatch
export const POST = dispatch
export const PATCH = dispatch
export const DELETE = dispatch
