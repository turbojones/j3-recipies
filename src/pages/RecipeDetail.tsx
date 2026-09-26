import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { recipes } from '../data/recipes'
import { downloadRecipePdf } from '../lib/recipePdf'
import { isListHeading, listHeadingLabel } from '../lib/listHeading'

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const recipe = useMemo(() => recipes.find((r) => r.id === id), [id])

  const [makeIt, setMakeIt] = useState(false)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const detailTopRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    setMakeIt(false)
    setChecked({})
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [id])

  if (!recipe) {
    return (
      <div className="page">
        <main className="content">
          <div className="detail-top-bar">
            <Link to="/" className="back-button">
              ← Back
            </Link>
            <Link to="/" className="detail-brand">
              <img
                src="/j3-brand.jpg"
                alt=""
                className="brand-mark"
                aria-hidden="true"
              />
              <span className="detail-brand-name">J3 Recipes</span>
            </Link>
          </div>
          <p className="empty">Recipe not found.</p>
        </main>
      </div>
    )
  }

  const walkthroughSrc = `/walkthroughs/${recipe.id}.mp4`
  const walkthroughVtt = `/walkthroughs/${recipe.id}.vtt`

  const toggleIngredient = (index: number) => {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const scrollToRecipeTop = () => {
    const go = () => {
      detailTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(go)
    })
  }

  const handleDone = () => {
    setChecked({})
    setMakeIt(false)
    scrollToRecipeTop()
  }

  const handleShare = async () => {
    const url = window.location.href
    const title = recipe.title
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title,
          text: `J3 Recipes · ${title}`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2000)
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        window.setTimeout(() => setShareCopied(false), 2000)
      } catch {
        setShareCopied(false)
      }
    }
  }

  return (
    <div className="page detail-page">
      <main className="content detail">
        <div className="detail-top-bar no-print" ref={detailTopRef}>
          <Link to="/" className="back-button">
            ← Back
          </Link>
          <Link to="/" className="detail-brand">
            <img
              src="/j3-brand.jpg"
              alt=""
              className="brand-mark"
              aria-hidden="true"
            />
            <span className="detail-brand-name">J3 Recipes</span>
          </Link>
          <button
            type="button"
            className="share-button"
            onClick={() => { void handleShare() }}
            aria-label={shareCopied ? 'Link copied' : 'Share recipe'}
            title={shareCopied ? 'Link copied' : 'Share'}
          >
            {shareCopied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <div className="detail-header">
          <h1 className="detail-title">{recipe.title}</h1>
          <div className="detail-header-actions no-print">
            {!makeIt && (
              <button
                type="button"
                className="pdf-button"
                onClick={() => { void downloadRecipePdf(recipe) }}
              >
                Download PDF
              </button>
            )}
          </div>
        </div>
        <p className="detail-meta">
          {recipe.cookTimeMinutes} min · {recipe.servings} servings · {recipe.cuisine}
        </p>

        <section className="walkthrough-video-block no-print" aria-label="Recipe walkthrough video">
          <video
            ref={videoRef}
            className="walkthrough-video"
            controls
            playsInline
            muted
            preload="metadata"
            poster="/j3-brand.jpg"
          >
            <source src={walkthroughSrc} type="video/mp4" />
            <track
              kind="captions"
              src={walkthroughVtt}
              srcLang="en"
              label="English"
              default
            />
          </video>
          <p className="walkthrough-video-caption">Short walkthrough · muted by default</p>
        </section>

        <section className="section">
          <h2>Ingredients</h2>
          <ul className={makeIt ? 'ingredient-list make-it' : 'ingredient-list'}>
            {recipe.ingredients.map((item, i) =>
              isListHeading(item) ? (
                <li key={i} className="list-subhead">
                  {listHeadingLabel(item)}
                </li>
              ) : makeIt ? (
                <li key={i}>
                  <label className="ingredient-check">
                    <input
                      type="checkbox"
                      checked={!!checked[i]}
                      onChange={() => toggleIngredient(i)}
                    />
                    <span className={checked[i] ? 'checked' : undefined}>{item}</span>
                  </label>
                </li>
              ) : (
                <li key={i}>{item}</li>
              ),
            )}
          </ul>
        </section>

        <section className="section">
          <h2>Steps</h2>
          <ol className="steps-list">
            {recipe.steps.map((step, i) =>
              isListHeading(step) ? (
                <li key={i} className="list-subhead">
                  {listHeadingLabel(step)}
                </li>
              ) : (
                <li key={i}>{step}</li>
              ),
            )}
          </ol>
        </section>
      </main>

      <div className="sticky-cta-bar no-print">
        {makeIt ? (
          <button type="button" className="cta" onClick={handleDone}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="cta"
            onClick={() => {
              setMakeIt(true)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            Make It
          </button>
        )}
      </div>
    </div>
  )
}
