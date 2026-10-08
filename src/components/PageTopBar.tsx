import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function PageTopBar({ backTo = '/', backLabel = '← Back', right }: { backTo?: string; backLabel?: string; right?: ReactNode }) {
  return (
    <div className="detail-top-bar">
      <Link to={backTo} className="back-button">
        {backLabel}
      </Link>
      <Link to="/" className="detail-brand">
        <img src="/j3-brand.jpg" alt="" className="brand-mark" aria-hidden="true" />
        <span className="detail-brand-name">J3 Recipes</span>
      </Link>
      {right && <div className="top-bar-right">{right}</div>}
    </div>
  )
}
