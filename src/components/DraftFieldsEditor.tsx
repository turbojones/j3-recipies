import type { ReactNode } from 'react'
import { RECIPE_GROUPS, type RecipeGroup } from '../types'
import type { DraftFields } from '../lib/submissions'

type Props = {
  fields: DraftFields
  onChange: (next: DraftFields) => void
  idPrefix: string
  /** Extra controls rendered after the section dropdown (e.g. cuisine in review). */
  extra?: ReactNode
}

export default function DraftFieldsEditor({ fields, onChange, idPrefix, extra }: Props) {
  const set = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) =>
    onChange({ ...fields, [key]: value })
  const id = (k: string) => `${idPrefix}-${k}`

  return (
    <div className="form-fields">
      <div className="field">
        <label htmlFor={id('title')}>Recipe title</label>
        <input
          id={id('title')}
          className="text-input"
          value={fields.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={120}
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={id('group')}>Section</label>
          <select
            id={id('group')}
            className="text-input"
            value={fields.group}
            onChange={(e) => set('group', e.target.value as RecipeGroup)}
          >
            {RECIPE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        {extra}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={id('time')}>Cook time (minutes)</label>
          <input
            id={id('time')}
            className="text-input"
            type="number"
            inputMode="numeric"
            min={1}
            value={fields.cookTime}
            onChange={(e) => set('cookTime', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={id('servings')}>Servings</label>
          <input
            id={id('servings')}
            className="text-input"
            type="number"
            inputMode="numeric"
            min={1}
            value={fields.servings}
            onChange={(e) => set('servings', e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={id('ingredients')}>Ingredients</label>
        <p className="field-hint">One per line. A line ending in a colon, like “Crust:”, becomes a subhead.</p>
        <textarea
          id={id('ingredients')}
          className="text-input"
          rows={8}
          value={fields.ingredients}
          onChange={(e) => set('ingredients', e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={id('steps')}>Steps</label>
        <p className="field-hint">One step per line. Subheads work here too.</p>
        <textarea
          id={id('steps')}
          className="text-input"
          rows={8}
          value={fields.steps}
          onChange={(e) => set('steps', e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={id('tips')}>
          Tips <span className="field-optional">(optional)</span>
        </label>
        <p className="field-hint">One per line.</p>
        <textarea
          id={id('tips')}
          className="text-input"
          rows={3}
          value={fields.tips}
          onChange={(e) => set('tips', e.target.value)}
        />
      </div>
    </div>
  )
}
