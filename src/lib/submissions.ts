import type { Recipe, RecipeGroup } from '../types'

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
  description?: string
  needsTranscription?: boolean
  recipe?: Recipe
  approvedAt?: string
  rejectedAt?: string
  addedAt?: string
}

export type SubmissionSummary = {
  id: string
  status: SubmissionStatus
  title: string
  group: RecipeGroup
  submitterName: string
  createdAt: string
  photoCount: number
  thumb: string | null
  hasPdf: boolean
  photosOnly?: boolean
}

/** Editable text form of a draft (one item per line). */
export type DraftFields = {
  title: string
  group: RecipeGroup
  cookTime: string
  servings: string
  ingredients: string
  steps: string
  tips: string
}

export const emptyFields = (): DraftFields => ({
  title: '',
  group: 'dinner',
  cookTime: '',
  servings: '',
  ingredients: '',
  steps: '',
  tips: '',
})

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function toNum(s: string): number | null {
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export function fieldsToDraft(f: DraftFields): Draft {
  return {
    title: f.title.trim(),
    group: f.group,
    cookTimeMinutes: toNum(f.cookTime),
    servings: toNum(f.servings),
    ingredients: splitLines(f.ingredients),
    steps: splitLines(f.steps),
    tips: splitLines(f.tips).map((t) => t.replace(/^tip:\s*/i, '')),
  }
}

export function draftToFields(d: Draft): DraftFields {
  return {
    title: d.title ?? '',
    group: d.group ?? 'dinner',
    cookTime: d.cookTimeMinutes ? String(d.cookTimeMinutes) : '',
    servings: d.servings ? String(d.servings) : '',
    ingredients: (d.ingredients ?? []).join('\n'),
    steps: (d.steps ?? []).join('\n'),
    tips: (d.tips ?? []).join('\n'),
  }
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

/** Same conversion the server uses on approve (tips become "Tip: " steps). */
export function draftToRecipe(d: Draft, cuisine = 'American'): Recipe {
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

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export function photoUrl(pathname: string): string {
  return `/api/admin/photo?path=${encodeURIComponent(pathname)}`
}
