import { useEffect, useRef, useState } from 'react'
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
  draftToRecipe,
  emptyFields,
  fieldsToDraft,
  type DraftFields,
} from '../lib/submissions'
import { isListHeading } from '../lib/listHeading'

type Step = 'form' | 'preview' | 'done'
type Tab = 'type' | 'upload'
/** Photo submissions only ask for a recipe name and a short description. */
const DESCRIPTION_MAX = 1000

export default function SubmitRecipe() {
  const [step, setStep] = useState<Step>('form')
  const [tab, setTab] = useState<Tab>('type')
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [fields, setFields] = useState<DraftFields>(emptyFields)
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [photoTitle, setPhotoTitle] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const dirRef = useRef(randomHex(16))
  const counterRef = useRef(0)
  const photosRef = useRef<PhotoItem[]>([])

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

  const uploadedPaths = photos.filter((p) => p.status === 'done' && p.pathname).map((p) => p.pathname!)

  const validate = (): string | null => {
    if (!name.trim()) return 'Please add your name.'
    if (tab === 'upload') {
      if (!photoTitle.trim()) return 'Please add the recipe name.'
      if (photos.some((p) => p.status === 'uploading')) return 'Please wait for the photos to finish uploading.'
      if (uploadedPaths.length === 0) return 'Please add at least one photo of the recipe.'
      return null
    }
    if (!draft.title) return 'Please add a recipe title.'
    if (draft.ingredients.filter((l) => !isListHeading(l)).length === 0) return 'Please add at least one ingredient.'
    if (draft.steps.filter((l) => !isListHeading(l)).length === 0) return 'Please add at least one step.'
    return null
  }

  const onFormSubmit = () => {
    const problem = validate()
    setFormError(problem)
    if (problem) {
      if (!name.trim()) document.getElementById('submit-name')?.focus()
      else if (tab === 'upload' && !photoTitle.trim()) document.getElementById('submit-photo-title')?.focus()
      return
    }
    if (tab === 'upload') void submit()
    else setStep('preview')
  }

  const submit = async () => {
    setSubmitting(true)
    setFormError(null)
    const photoMode = tab === 'upload'
    try {
      await api('/api/submit', {
        method: 'POST',
        body: JSON.stringify(
          photoMode
            ? {
                mode: 'upload',
                name: name.trim(),
                website,
                draft: { ...fieldsToDraft(emptyFields()), title: photoTitle.trim() },
                description: description.trim(),
                photos: uploadedPaths,
              }
            : { mode: 'typed', name: name.trim(), website, draft, photos: [] },
        ),
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
    setPhotoTitle('')
    setDescription('')
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
    return (
      <div className="page">
        <main className="content form-page">
          <PageTopBar />
          <p className="form-eyebrow">Preview</p>
          <div className="preview-card">
            <RecipePreview recipe={{ ...draftToRecipe(draft), cuisine: '' }} />
          </div>
          <p className="preview-by">Submitted by {name.trim()}</p>
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

  const uploading = photos.some((p) => p.status === 'uploading')

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
            onFormSubmit()
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
              <div className="form-fields">
                <div className="field">
                  <label htmlFor="submit-photo-title">Recipe name</label>
                  <input
                    id="submit-photo-title"
                    className="text-input"
                    value={photoTitle}
                    onChange={(e) => setPhotoTitle(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="submit-description">Description</label>
                  <textarea
                    id="submit-description"
                    className="text-input"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={DESCRIPTION_MAX}
                    placeholder="A line or two about the recipe (optional)"
                  />
                </div>
                <div className="field">
                  <p className="field-label">Photos</p>
                  <p className="field-hint">
                    Snap or choose photos of the recipe card (front and back, or each page), or add a PDF. We’ll type it up from these.
                  </p>
                  <PhotoStrip
                    photos={photos}
                    onAdd={(f) => { void addFiles(f) }}
                    onRemove={removePhoto}
                    onMove={movePhoto}
                    canAdd={photos.length < MAX_PHOTOS}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'type' && (
            <div className="tab-panel" role="tabpanel">
              <DraftFieldsEditor fields={fields} onChange={setFields} idPrefix="submit" />
            </div>
          )}

          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-actions">
            <button type="submit" className="cta" disabled={submitting || (tab === 'upload' && uploading)}>
              {tab === 'upload' ? (submitting ? 'Submitting…' : uploading ? 'Uploading…' : 'Submit recipe') : 'Preview'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
