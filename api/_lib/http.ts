export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status)
}

/** Read a JSON body with a byte cap. Returns undefined when missing/invalid/too large. */
export async function readJson<T = unknown>(req: Request, maxBytes = 256 * 1024): Promise<T | undefined> {
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > maxBytes) return undefined
  try {
    const text = await req.text()
    if (text.length > maxBytes) return undefined
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  return (
    req.headers.get('x-real-ip') ??
    fwd.split(',')[0]?.trim() ??
    'unknown'
  ) || 'unknown'
}

// Best-effort in-memory throttle (per function instance).
const buckets = new Map<string, number[]>()

/** Returns true when the call is allowed, false when over the limit. */
export function throttle(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}

export function countRecent(key: string, windowMs: number): number {
  const now = Date.now()
  return (buckets.get(key) ?? []).filter((t) => now - t < windowMs).length
}

export function record(key: string): void {
  const hits = buckets.get(key) ?? []
  hits.push(Date.now())
  buckets.set(key, hits)
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
