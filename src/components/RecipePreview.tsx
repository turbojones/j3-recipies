import type { Recipe } from '../types'
import { RECIPE_GROUPS } from '../types'
import { isListHeading, listHeadingLabel } from '../lib/listHeading'

/** Read-only recipe card using the same markup/classes as the detail page. */
export default function RecipePreview({ recipe }: { recipe: Recipe }) {
  const groupLabel = RECIPE_GROUPS.find((g) => g.id === recipe.group)?.label
  const meta = [
    recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes} min` : null,
    recipe.servings ? `${recipe.servings} servings` : null,
    recipe.cuisine || null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="recipe-preview">
      {groupLabel && <p className="preview-group">{groupLabel}</p>}
      <h1 className="detail-title">{recipe.title || 'Untitled recipe'}</h1>
      {meta && <p className="detail-meta">{meta}</p>}

      <section className="section">
        <h2>Ingredients</h2>
        <ul className="ingredient-list">
          {recipe.ingredients.map((item, i) =>
            isListHeading(item) ? (
              <li key={i} className="list-subhead">
                {listHeadingLabel(item)}
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
    </article>
  )
}
