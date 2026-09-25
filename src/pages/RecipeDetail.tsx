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
          <p className="empty">No recipes match.</p>
          <Link to="/" className="back-link">
            ← Back
          </Link>
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
    <div className="page">
      <main className="content detail">
        <Link to="/" className="back-link no-print">
          ← Back
        </Link>

        <div className="detail-header">
          <h1 className="detail-title">{recipe.title}</h1>
          {!makeIt && (
            <button
              type="button"
              className="print-link no-print"
              onClick={() => downloadRecipePdf(recipe)}
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

        {makeIt ? (
          <button type="button" className="cta no-print" onClick={handleDone}>
            Done
          </button>
        ) : (
          <button
            type="button"
            className="cta no-print"
            onClick={() => {
              setMakeIt(true)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            Make It
          </button>
        )}
      </main>
    </div>
  )
}
