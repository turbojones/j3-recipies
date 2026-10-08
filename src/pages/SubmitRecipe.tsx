import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DraftFieldsEditor from '../components/DraftFieldsEditor'
import PageTopBar from '../components/PageTopBar'
import PhotoStrip, { type PhotoItem } from '../components/PhotoStrip'
import RecipePreview from '../components/RecipePreview'
import {
  compressImage,
  isAllowedType,
  MAX_BYTES,
  MAX_PHOTOS,
  randomHex,
  uploadPhoto,
} from '../lib/imageUpload'
import {
  api,
  draftToFields,
  draftToRecipe,
  emptyFields,
  fieldsToDraft,
  type Draft,
  type DraftFields,
} from '../lib/submissions'
import { isListHeading } from '../lib/listHeading'

type Step = 'form' | 'preview' | 'done'
type Tab = 'type' | 'upload'
type AutofillState = 'idle' | 'running' | 'done' | 'failed'

function fieldsEmpty(f: DraftFields): boolean {
  return !f.title.trim() && !f.ingredients.trim() && !f.steps.trim()
}

export default function SubmitRecipe() {
  const [step, setStep] = useState<Step>('form')
  const [tab, setTab] = useState<Tab>('type')
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [fields, setFields] = useState<DraftFields>(emptyFields)
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [autofill, setAutofill] = useState<AutofillState>('idle')
  const [autofillNote, setAutofillNote] = useState<string | null>(null)
  const [autofilled, setAutofilled] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const dirRef = useRef(randomHex(16))
  const counterRef = useRef(0)
  const photosRef = useRef<PhotoItem[]>([])
  const fieldsRef = useRef<DraftFields>(fields)
  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])

  /** Update photos and keep the ref in sync immediately (async upload callbacks read it). */
  const commitPhotos = (fn: (prev: PhotoItem[]) => PhotoItem[]) => {
    const next = fn(photosRef.current)
    photosRef.current = next
    setPhotos(next)
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  useEffect(
    () => () => {
      for (const p of photosRef.current) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
    },
    [],
  )

  const updatePhoto = (key: string, patch: Partial<PhotoItem>) =>
    commitPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  const runAutofill = useCallback(async () => {
    const paths = photosRef.current.filter((p) => p.status === 'done' && p.pathname).map((p) => p.pathname!)
    if (paths.length === 0) return
    setAutofill('running')
    setAutofillNote(null)
    try {
      const { draft } = await api<{ draft: Draft }>('/api/autofill', {
        method: 'POST',
        body: JSON.stringify({ photos: paths }),
      })
      if (!draft.title && draft.ingredients.length === 0 && draft.steps.length === 0) {
        throw new Error('empty')
      }
      setFields(draftToFields(draft))
      setAutofilled(true)
      setAutofill('done')
      setAutofillNote('We filled this in from your photos. Please check it over.')
    } catch {
      setAutofill('failed')
      setAutofillNote("We couldn't read the photos automatically. Please type the recipe in below. Your photos stay attached.")
    }
    setTab('type')
  }, [])

  const addFiles = async (files: File[]) => {
    setFormError(null)
    const room = MAX_PHOTOS - photosRef.current.length
    const accepted = files.filter((f) => isAllowedType(f.type) || f.type.startsWith('image/'))
    if (accepted.length < files.length) setFormError('Only photos or PDFs can be added.')
    if (accepted.length > room) setFormError(`You can attach up to ${MAX_PHOTOS} photos.`)
    const batch = accepted.slice(0, Math.max(0, room)).map((file) => {
      const isPdf = file.type === 'application/pdf'
      counterRef.current += 1
      return {
        file,
        index: counterRef.current,
        item: {
          key: `${counterRef.current}-${randomHex(4)}`,
          kind: isPdf ? 'pdf' : 'image',
          name: file.name,
          previewUrl: isPdf ? null : URL.createObjectURL(file),
          status: 'uploading',
        } as PhotoItem,
      }
    })
    if (batch.length === 0) return
    commitPhotos((prev) => [...prev, ...batch.map((b) => b.item)])

    await Promise.all(
      batch.map(async ({ file, index, item }) => {
        try {
          const blob = await compressImage(file)
          if (blob.size > MAX_BYTES) {
            updatePhoto(item.key, { status: 'error', error: 'Over 10 MB' })
            return
          }
          const typed = blob.type ? blob : new Blob([blob], { type: 'image/jpeg' })
          const pathname = await uploadPhoto(dirRef.current, index, typed)
          updatePhoto(item.key, { status: 'done', pathname })
        } catch {
          updatePhoto(item.key, { status: 'error', error: 'Upload failed' })
        }
      }),
    )
    if (fieldsEmpty(fieldsRef.current) && photosRef.current.some((p) => p.status === 'done')) {
      void runAutofill()
    }
  }

  const removePhoto = (key: string) => {
    commitPhotos((prev) => {
      const gone = prev.find((p) => p.key === key)
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
      return prev.filter((p) => p.key !== key)
    })
  }

  const movePhoto = (from: number, to: number) => {
    commitPhotos((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = prev.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const draft = fieldsToDraft(fields)

  const validate = (): string | null => {
    if (!name.trim()) return 'Please add your name.'
    if (!draft.title) return 'Please add a recipe title.'
    if (draft.ingredients.filter((l) => !isListHeading(l)).length === 0) return 'Please add at least one ingredient.'
    if (draft.steps.filter((l) => !isListHeading(l)).length === 0) return 'Please add at least one step.'
    if (photos.some((p) => p.status === 'uploading')) return 'Please wait for the photos to finish uploading.'
    if (autofill === 'running') return 'Please wait while we read your photos.'
    return null
  }

  const goPreview = () => {
    const problem = validate()
    setFormError(problem)
    if (problem) {
      if (!name.trim()) document.getElementById('submit-name')?.focus()
      return
    }
    setStep('preview')
  }

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    try {
      await api('/api/submit', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          website,
          draft,
          autofilled,
          photos: photos.filter((p) => p.status === 'done' && p.pathname).map((p) => p.pathname),
        }),
      })
      setStep('done')
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    for (const p of photos) if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
    commitPhotos(() => [])
    setFields(emptyFields())
    setAutofill('idle')
    setAutofillNote(null)
    setAutofilled(false)
    setFormError(null)
    setTab('type')
    dirRef.current = randomHex(16)
    setStep('form')
  }

  if (step === 'done') {
    return (
      <div className="page">
        <main className="content form-page">
          <PageTopBar />
          <div className="thanks">
            <h1 className="detail-title">Thanks, it’s in review</h1>
            <p className="detail-meta">We’ll take a look at your recipe soon.</p>
            <Link to="/" className="cta cta-link">
              Back to recipes
            </Link>
            <button type="button" className="text-button" onClick={reset}>
              Submit another recipe
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (step === 'preview') {
    const attached = photos.filter((p) => p.status === 'done').length
    return (
      <div className="page">
        <main className="content form-page">
          <PageTopBar />
          <p className="form-eyebrow">Preview</p>
          <div className="preview-card">
            <RecipePreview recipe={{ ...draftToRecipe(draft), cuisine: '' }} />
          </div>
          <p className="preview-by">
            Submitted by {name.trim()}
            {attached > 0 && ` · ${attached} photo${attached === 1 ? '' : 's'} attached`}
          </p>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-actions">
            <button type="button" className="cta" onClick={() => { void submit() }} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit recipe'}
            </button>
            <button type="button" className="secondary-button" onClick={() => setStep('form')} disabled={submitting}>
              Edit
            </button>
          </div>
        </main>
      </div>
    )
  }

  const busy = autofill === 'running'
  const canRefill = photos.some((p) => p.status === 'done') && !busy

  return (
    <div className="page">
      <main className="content form-page">
        <PageTopBar />
        <h1 className="detail-title">Submit a recipe</h1>
        <p className="detail-meta">Share a family favorite. We’ll review it before it goes up.</p>

        <form
          className="submit-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            goPreview()
          }}
        >
          <div className="field">
            <label htmlFor="submit-name">Your name</label>
            <input
              id="submit-name"
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoComplete="name"
              required
            />
          </div>

          {/* Honeypot: hidden from people, tempting to bots */}
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="submit-website">Website</label>
            <input
              id="submit-website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="tabs" role="tablist" aria-label="How to add the recipe">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'type'}
              className={tab === 'type' ? 'tab active' : 'tab'}
              onClick={() => setTab('type')}
            >
              Type it in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'upload'}
              className={tab === 'upload' ? 'tab active' : 'tab'}
              onClick={() => setTab('upload')}
            >
              Upload photos
            </button>
          </div>

          {tab === 'upload' && (
            <div className="tab-panel" role="tabpanel">
              <p className="field-hint">
                Snap or choose photos of the recipe card (front and back, or each page), or add a PDF. Put them in
                page order and we’ll fill in the form for you to check.
              </p>
              <PhotoStrip
                photos={photos}
                onAdd={(f) => { void addFiles(f) }}
                onRemove={removePhoto}
                onMove={movePhoto}
                canAdd={photos.length < MAX_PHOTOS}
              />
              {busy && <p className="autofill-status">Reading your photos…</p>}
              {canRefill && (
                <button type="button" className="secondary-button" onClick={() => { void runAutofill() }}>
                  Fill in the form from these photos
                </button>
              )}
            </div>
          )}

          {tab === 'type' && (
            <div className="tab-panel" role="tabpanel">
              {photos.length > 0 && (
                <div className="attached-photos">
                  <p className="field-label">Attached photos</p>
                  <PhotoStrip
                    photos={photos}
                    onAdd={(f) => { void addFiles(f) }}
                    onRemove={removePhoto}
                    onMove={movePhoto}
                    canAdd={photos.length < MAX_PHOTOS}
                  />
                  {canRefill && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        if (fieldsEmpty(fields) || window.confirm('Replace what’s in the form with what we read from the photos?')) {
                          void runAutofill()
                        }
                      }}
                    >
                      Re-read photos
                    </button>
                  )}
                </div>
              )}
              {busy && <p className="autofill-status">Reading your photos…</p>}
              {autofillNote && (
                <p className={autofill === 'failed' ? 'autofill-note warn' : 'autofill-note'}>{autofillNote}</p>
              )}
              <DraftFieldsEditor fields={fields} onChange={setFields} idPrefix="submit" />
            </div>
          )}

          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-actions">
            <button type="submit" className="cta" disabled={busy}>
              Preview
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
