import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { recipes } from '../data/recipes'
import { RECIPE_GROUPS } from '../types'

export default function RecipeList() {
  const [query, setQuery] = useState('')
  const searchBarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = searchBarRef.current
    if (!el) return

    const sync = () => {
      document.documentElement.style.setProperty(
        '--search-bar-height',
        `${el.getBoundingClientRect().height}px`,
      )
    }

    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipes

    const groupLabel = (groupId: string) =>
      RECIPE_GROUPS.find((g) => g.id === groupId)?.label.toLowerCase() ?? ''

    return recipes.filter((r) => {
      const haystack = [
        r.title,
        r.cuisine,
        r.group,
        groupLabel(r.group),
        ...r.ingredients,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query])

  const grouped = useMemo(() => {
    return RECIPE_GROUPS.map((g) => ({
      ...g,
      recipes: filtered.filter((r) => r.group === g.id),
    })).filter((g) => g.recipes.length > 0)
  }, [filtered])

  const emptyMessage =
    recipes.length === 0
      ? 'No recipes yet.'
      : filtered.length === 0
        ? 'No recipes match.'
        : null

  return (
    <div className="page">
      <div className="brand-hero">
        <img
          src="/j3-brand.jpg"
          alt="J3 Recipes"
          className="brand-hero-img"
        />
        <div className="brand-hero-overlay">
          <p className="brand-hero-name">J3 Recipes</p>
        </div>
      </div>

      <header className="search-bar" ref={searchBarRef}>
        <div className="brand-lockup">
          <img
            src="/j3-brand.jpg"
            alt=""
            className="brand-mark"
            aria-hidden="true"
          />
          <h1 className="app-title">J3 Recipes</h1>
        </div>
        <input
          type="search"
          className="search-input"
          placeholder="Search recipes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search recipes"
        />
      </header>

      <main className="content">
        {emptyMessage ? (
          <p className="empty">{emptyMessage}</p>
        ) : (
          grouped.map((section) => (
            <section key={section.id} className="recipe-group">
              <h2 className="group-heading">{section.label}</h2>
              <ul className="recipe-list">
                {section.recipes.map((r) => (
                  <li key={r.id}>
                    <Link to={`/recipe/${r.id}`} className="recipe-row">
                      <span className="recipe-row-title">{r.title}</span>
                      <span className="recipe-row-meta">{r.cookTimeMinutes} min</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
