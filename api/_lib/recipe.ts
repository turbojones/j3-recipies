export const GROUP_IDS = [
  'dinner',
  'salad',
  'side',
  'muffins-and-bread',
  'cookies',
  'cakes',
  'extras',
] as const
export type RecipeGroup = (typeof GROUP_IDS)[number]

export type Recipe = {
  id: string
  title: string
  group: RecipeGroup
  cuisine: string
  cookTimeMinutes: number
  servings: number
  ingredients: string[]
  steps: string[]
}

export type Draft = {
  title: string
  group: RecipeGroup
  cookTimeMinutes: number | null
  servings: number | null
  ingredients: string[]
  steps: string[]
  tips: string[]
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'added'

export type Photo = { pathname: string; contentType: string; size: number }

export type Submission = {
  id: string
  status: SubmissionStatus
  createdAt: string
  updatedAt: string
  submitterName: string
  source: 'typed' | 'upload'
  photos: Photo[]
  draft: Draft
  cuisine: string
  autofilled: boolean
  recipe?: Recipe
  approvedAt?: string
  rejectedAt?: string
  addedAt?: string
}

export const LIMITS = {
  name: 80,
  title: 120,
  cuisine: 40,
  line: 600,
  stepLine: 2000,
  ingredients: 120,
  steps: 80,
  tips: 40,
  photos: 10,
  photoBytes: 10 * 1024 * 1024,
}

export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]

/** Upload pathnames: uploads/<32+ hex>/<n>-<slug>.<ext>, plus the random suffix Blob adds. */
export const UPLOAD_PATH_RE = /^uploads\/[a-f0-9]{32}\/[A-Za-z0-9._-]{1,120}$/

export const ID_RE = /^[a-z0-9]{6,12}-[a-f0-9]{12}$/

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function lines(v: unknown, maxItems: number, maxLen: number): string[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : []
  return arr
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.replace(/\s+/g, ' ').trim().slice(0, maxLen))
    .filter((x) => x.length > 0)
    .slice(0, maxItems)
}

function num(v: unknown, max: number): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.round(n), max)
}

export function isGroup(v: unknown): v is RecipeGroup {
  return typeof v === 'string' && (GROUP_IDS as readonly string[]).includes(v)
}

export function cleanName(v: unknown): string {
  return str(v, LIMITS.name)
}

export function cleanCuisine(v: unknown): string {
  return str(v, LIMITS.cuisine) || 'American'
}

export function cleanDraft(input: unknown): Draft {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  return {
    title: str(o.title, LIMITS.title),
    group: isGroup(o.group) ? o.group : 'dinner',
    cookTimeMinutes: num(o.cookTimeMinutes, 10000),
    servings: num(o.servings, 500),
    ingredients: lines(o.ingredients, LIMITS.ingredients, LIMITS.line),
    steps: lines(o.steps, LIMITS.steps, LIMITS.stepLine),
    tips: lines(o.tips, LIMITS.tips, LIMITS.line).map((t) => t.replace(/^tip:\s*/i, '')),
  }
}

/** Returns an error message, or null when the draft has the required fields. */
export function draftProblem(d: Draft): string | null {
  if (!d.title) return 'Title is required.'
  if (d.ingredients.filter((l) => !isHeading(l)).length < 1) return 'Add at least one ingredient.'
  if (d.steps.filter((l) => !isHeading(l)).length < 1) return 'Add at least one step.'
  return null
}

export function isHeading(item: string): boolean {
  return /^[A-Za-z][A-Za-z0-9 &-]{0,40}:$/.test(item.trim())
}

export function slugify(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'recipe'
  )
}

export function toRecipe(d: Draft, cuisine: string): Recipe {
  return {
    id: slugify(d.title),
    title: d.title,
    group: d.group,
    cuisine,
    cookTimeMinutes: d.cookTimeMinutes ?? 0,
    servings: d.servings ?? 0,
    ingredients: d.ingredients,
    steps: [...d.steps, ...d.tips.map((t) => `Tip: ${t}`)],
  }
}
