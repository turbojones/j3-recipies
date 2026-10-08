import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DraftFieldsEditor from '../components/DraftFieldsEditor'
import PageTopBar from '../components/PageTopBar'
import PhotoStack from '../components/PhotoStack'
import { recipes } from '../data/recipes'
import {
  api,
  ApiError,
  draftToFields,
  fieldsToDraft,
  photoUrl,
  slugify,
  type DraftFields,
  type Submission,
  type SubmissionSummary,
} from '../lib/submissions'
import { RECIPE_GROUPS } from '../types'

type Auth = 'checking' | 'out' | 'in'

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
] as const
type TabId = (typeof TABS)[number]['id']

const groupLabel = (id: string) => RECIPE_GROUPS.find((g) => g.id === id)?.label ?? id

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const prevTitle = document.title
    document.title = 'Review · J3 Recipes'
    return () => {
      meta.remove()
      document.title = prevTitle
    }
  }, [])
}

export default function Review() {
  useNoIndex()
  const { id } = useParams<{ id: string }>()
  const [auth, setAuth] = useState<Auth>('checking')

  useEffect(() => {
    api('/api/admin/session')
      .then(() => setAuth('in'))
      .catch(() => setAuth('out'))
  }, [])

  const onUnauthorized = useCallback(() => setAuth('out'), [])

  const logout = async () => {
    try {
      await api('/api/admin/logout', { method: 'POST' })
    } finally {
      setAuth('out')
    }
  }

  if (auth === 'checking') {
    return (
      <div className="page">
        <main className="content form-page">
          <p className="empty">Loading…</p>
        </main>
      </div>
    )
  }

  if (auth === 'out') return <PasscodeScreen onSuccess={() => setAuth('in')} />

  const logoutButton = (
    <button type="button" className="text-button" onClick={() => { void logout() }}>
      Log out
    </button>
  )

  return id ? (
    <ReviewDetail id={id} onUnauthorized={onUnauthorized} logoutButton={logoutButton} />
  ) : (
    <ReviewList onUnauthorized={onUnauthorized} logoutButton={logoutButton} />
  )
}

function PasscodeScreen({ onSuccess }: { onSuccess: () => void }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!passcode) return
    setBusy(true)
    setError(null)
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ passcode }) })
      setPasscode('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <main className="content form-page">
        <PageTopBar />
        <form className="passcode-form" onSubmit={(e) => { void submit(e) }}>
          <h1 className="detail-title">Review submissions</h1>
          <div className="field">
            <label htmlFor="review-passcode">Passcode</label>
            <input
              id="review-passcode"
              className="text-input"
              type="password"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="cta" disabled={busy || !passcode}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </main>
    </div>
  )
}

function ReviewList({ onUnauthorized, logoutButton }: { onUnauthorized: () => void; logoutButton: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const flash = (location.state as { flash?: string } | null)?.flash
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'pending') as TabId
  const [items, setItems] = useState<SubmissionSummary[] | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(null)
    api<{ items: SubmissionSummary[]; pendingCount?: number }>(`/api/admin/list?status=${tab}`)
      .then((r) => {
        if (!cancelled) {
          setItems(r.items)
          if (typeof r.pendingCount === 'number') setPendingCount(r.pendingCount)
        }
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) onUnauthorized()
        else setError('Could not load submissions.')
      })
    return () => {
      cancelled = true
    }
  }, [tab, onUnauthorized])

  return (
    <div className="page">
      <main className="content review-page">
        <PageTopBar right={logoutButton} />
        <h1 className="detail-title">Submissions</h1>
        {flash && <p className="flash">{flash}</p>}
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setParams(t.id === 'pending' ? {} : { tab: t.id }, { replace: true })}
            >
              {t.id === 'pending' && pendingCount !== null ? `${t.label} (${pendingCount})` : t.label}
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}
        {!items && !error && <p className="empty">Loading…</p>}
        {items && items.length === 0 && <p className="empty">Nothing here.</p>}
        {items && items.length > 0 && (
          <ul className="review-list">
            {items.map((s) => (
              <li key={s.id}>
                <Link to={`/review/${s.id}`} className="review-row">
                  <span className="review-thumb">
                    {s.thumb ? (
                      <img src={photoUrl(s.thumb)} alt="" loading="lazy" />
                    ) : s.hasPdf ? (
                      <span className="review-thumb-label">PDF</span>
                    ) : (
                      <span className="review-thumb-label">Typed</span>
                    )}
                  </span>
                  <span className="review-row-main">
                    <span className="recipe-row-title">{s.title || 'Untitled'}</span>
                    <span className="review-row-meta">
                      {groupLabel(s.group)} · {s.submitterName} · {formatDate(s.createdAt)}
                      {s.photosOnly && <span className="status-tag photos-only">Photos only</span>}
                      {s.status === 'added' && <span className="status-tag">Added</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function ReviewDetail({
  id,
  onUnauthorized,
  logoutButton,
}: {
  id: string
  onUnauthorized: () => void
  logoutButton: ReactNode
}) {
  const navigate = useNavigate()
  const [sub, setSub] = useState<Submission | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fields, setFields] = useState<DraftFields | null>(null)
  const [cuisine, setCuisine] = useState('American')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)

  const handleError = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof ApiError && e.status === 401) onUnauthorized()
      else setError(e instanceof Error ? e.message : fallback)
    },
    [onUnauthorized],
  )

  const load = useCallback(
    (s: Submission) => {
      setSub(s)
      setFields(draftToFields(s.draft))
      setCuisine(s.cuisine || 'American')
      setDirty(false)
    },
    [],
  )

  useEffect(() => {
    window.scrollTo(0, 0)
    api<{ submission: Submission }>(`/api/admin/submission?id=${encodeURIComponent(id)}`)
      .then((r) => load(r.submission))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) onUnauthorized()
        else setLoadError(e instanceof ApiError && e.status === 404 ? 'Submission not found.' : 'Could not load it.')
      })
  }, [id, load, onUnauthorized])

  const duplicate = useMemo(() => {
    const title = fields?.title.trim().toLowerCase()
    if (!title) return null
    const slug = slugify(title)
    return recipes.find((r) => r.title.trim().toLowerCase() === title || r.id === slug) ?? null
  }, [fields?.title])

  if (loadError) {
    return (
      <div className="page">
        <main className="content review-page">
          <PageTopBar backTo="/review" right={logoutButton} />
          <p className="empty">{loadError}</p>
        </main>
      </div>
    )
  }
  if (!sub || !fields) {
    return (
      <div className="page">
        <main className="content review-page">
          <PageTopBar backTo="/review" right={logoutButton} />
          <p className="empty">Loading…</p>
        </main>
      </div>
    )
  }

  const backTab = sub.status === 'pending' ? '/review' : `/review?tab=${sub.status === 'added' ? 'approved' : sub.status}`

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await fn()
    } catch (e) {
      handleError(e, fallback)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      const r = await api<{ submission: Submission }>(`/api/admin/submission?id=${encodeURIComponent(sub.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ draft: fieldsToDraft(fields), cuisine }),
      })
      load(r.submission)
      setMessage('Saved.')
    }, 'Could not save.')

  const approve = () =>
    run(async () => {
      const draft = fieldsToDraft(fields)
      const r = await api<{ submission: Submission }>('/api/admin/approve', {
        method: 'POST',
        body: JSON.stringify({ id: sub.id, draft, cuisine }),
      })
      navigate('/review', { state: { flash: r.submission.needsTranscription ? `Approved “${r.submission.draft.title}”. Chef will type it up from the photos.` : `Approved “${r.submission.draft.title}”. It’s ready to add to the site.` } })
    }, 'Could not approve.')

  const reject = () => {
    if (!window.confirm(`Reject “${fields.title || 'this recipe'}”?`)) return
    void run(async () => {
      await api('/api/admin/reject', { method: 'POST', body: JSON.stringify({ id: sub.id }) })
      navigate('/review', { state: { flash: `Rejected “${fields.title || 'Untitled'}”.` } })
    }, 'Could not reject.')
  }

  const remove = () => {
    if (!window.confirm('Delete this submission and its photos for good?')) return
    void run(async () => {
      await api(`/api/admin/submission?id=${encodeURIComponent(sub.id)}`, { method: 'DELETE' })
      navigate(backTab, { state: { flash: 'Deleted.' } })
    }, 'Could not delete.')
  }

  const copyJson = async () => {
    if (!sub.recipe) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(sub.recipe, null, 2))
      setMessage('Recipe JSON copied.')
    } catch {
      setError('Could not copy.')
    }
  }

  const statusLine =
    sub.status === 'approved'
      ? sub.needsTranscription
        ? 'Approved. Chef will type it up from the photos and add it.'
        : 'Approved, waiting to be added to the site.'
      : sub.status === 'added'
        ? 'Approved and added to the site.'
        : sub.status === 'rejected'
          ? 'Rejected.'
          : null

  return (
    <div className="page">
      <main className="content review-page">
        <PageTopBar backTo={backTab} backLabel="← Queue" right={logoutButton} />

        <div className={showOriginal ? 'review-split show-original' : 'review-split'}>
          <section className="review-originals" aria-label="Original photos">
            <PhotoStack photos={sub.photos} />
          </section>

          <section className="review-draft" aria-label="Draft">
            <div className="review-draft-head">
              <p className="form-eyebrow">
                From {sub.submitterName} · {formatDate(sub.createdAt)}
                {sub.autofilled && ' · auto-filled'}
              </p>
              {sub.photos.length > 0 && (
                <button
                  type="button"
                  className="secondary-button small view-original-toggle"
                  onClick={() => setShowOriginal((v) => !v)}
                  aria-expanded={showOriginal}
                >
                  {showOriginal ? 'Hide original' : `View original (${sub.photos.length})`}
                </button>
              )}
            </div>

            {statusLine && <p className="flash">{statusLine}</p>}
            {sub.description && (
              <div className="submitter-note">
                <p className="field-label">Their description</p>
                <p>{sub.description}</p>
              </div>
            )}
            {sub.source === 'upload' && sub.status === 'pending' && (
              <p className="field-hint">Sent as photos. You can approve it as is and Chef will type it up, or fill in the recipe below first.</p>
            )}
            {duplicate && (
              <p className="dup-warning" role="status">
                Heads up: this looks like an existing recipe, <Link to={`/recipe/${duplicate.id}`}>{duplicate.title}</Link>.
              </p>
            )}

            <DraftFieldsEditor
              fields={fields}
              idPrefix="review"
              onChange={(f) => {
                setFields(f)
                setDirty(true)
                setMessage(null)
              }}
              extra={
                <div className="field">
                  <label htmlFor="review-cuisine">Cuisine</label>
                  <input
                    id="review-cuisine"
                    className="text-input"
                    value={cuisine}
                    maxLength={40}
                    onChange={(e) => {
                      setCuisine(e.target.value)
                      setDirty(true)
                    }}
                  />
                </div>
              }
            />

            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="flash">{message}</p>}

            <div className="form-actions">
              {sub.status !== 'added' && (
                <button type="button" className="cta" onClick={() => { void approve() }} disabled={busy}>
                  {sub.status === 'approved' ? 'Save & keep approved' : 'Approve'}
                </button>
              )}
              <button type="button" className="secondary-button" onClick={() => { void save() }} disabled={busy || !dirty}>
                Save changes
              </button>
              {sub.recipe && (
                <button type="button" className="secondary-button" onClick={() => { void copyJson() }}>
                  Copy recipe JSON
                </button>
              )}
            </div>
            <div className="quiet-actions">
              {sub.status !== 'rejected' && sub.status !== 'added' && (
                <button type="button" className="text-button danger" onClick={reject} disabled={busy}>
                  Reject
                </button>
              )}
              {sub.status === 'rejected' && (
                <button type="button" className="text-button danger" onClick={remove} disabled={busy}>
                  Delete for good
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
