import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import RecipeList from './pages/RecipeList'
import RecipeDetail from './pages/RecipeDetail'

const SubmitRecipe = lazy(() => import('./pages/SubmitRecipe'))
const Review = lazy(() => import('./pages/Review'))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<RecipeList />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/submit" element={<SubmitRecipe />} />
        <Route path="/review" element={<Review />} />
        <Route path="/review/:id" element={<Review />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
