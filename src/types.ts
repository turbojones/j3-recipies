export type RecipeGroup =
  | 'dinner'
  | 'muffins-and-bread'
  | 'cookies'
  | 'cakes'
  | 'extras'
  | 'salad'
  | 'side'

export type Recipe = {
  id: string
  title: string
  group: RecipeGroup
  cuisine: string
  cookTimeMinutes: number
  servings: number
  ingredients: string[]
  steps: string[]
}

export const RECIPE_GROUPS: { id: RecipeGroup; label: string }[] = [
  { id: 'dinner', label: 'Dinners' },
  { id: 'salad', label: 'Salads' },
  { id: 'side', label: 'Sides' },
  { id: 'muffins-and-bread', label: 'Muffins and Bread' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'cakes', label: 'Cakes' },
  { id: 'extras', label: 'Extras' },
]
