import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { recipes } from '../data/recipes'
import { downloadRecipePdf } from '../lib/recipePdf'

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const recipe = useMemo(() => recipes.find((r) => r.id === id), [id])

  const [makeIt, setMakeIt] = useState(false)
  const [checked, setChecked] = useState<Record<number, boolean>>({})

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
              <span className="detail-brand-name">J3 Recipies</span>
            </Link>
          </div>
          <p className="empty">Recipe not found.</p>
        </main>
      </div>
    )
  }

  const toggleIngredient = (index: number) => {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const handleDone = () => {
    setChecked({})
    setMakeIt(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="page detail-page">
      <main className="content detail">
        <div className="detail-top-bar no-print">
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
            <span className="detail-brand-name">J3 Recipies</span>
          </Link>
        </div>
        <div className="detail-header">
          <h1 className="detail-title">{recipe.title}</h1>
          {!makeIt && (
            <button
              type="button"
              className="print-link no-print"
              onClick={() => { void downloadRecipePdf(recipe) }}
            >
              Download PDF
            </button>
          )}
        </div>
        <p className="detail-meta">
          {recipe.cookTimeMinutes} min · {recipe.servings} servings · {recipe.cuisine}
        </p>

        <section className="section">
          <h2>Ingredients</h2>
          <ul className={makeIt ? 'ingredient-list make-it' : 'ingredient-list'}>
            {recipe.ingredients.map((item, i) =>
              makeIt ? (
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
            {recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
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
