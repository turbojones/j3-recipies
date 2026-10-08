import { useRef, useState } from 'react'
import { photoUrl, type Photo } from '../lib/submissions'

/** Swipeable / arrow-driven stack of the original submission photos. */
export default function PhotoStack({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)

  if (photos.length === 0) {
    return <p className="stack-empty">No photos. This one was typed in.</p>
  }

  const i = Math.min(index, photos.length - 1)
  const photo = photos[i]
  const go = (d: number) => setIndex((v) => Math.max(0, Math.min(photos.length - 1, v + d)))
  const url = photoUrl(photo.pathname)
  const isPdf = photo.contentType === 'application/pdf'

  return (
    <div className="photo-stack">
      <div
        className="photo-stack-frame"
        onPointerDown={(e) => {
          startX.current = e.clientX
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return
          const dx = e.clientX - startX.current
          startX.current = null
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}
        onPointerCancel={() => {
          startX.current = null
        }}
      >
        {isPdf ? (
          <iframe src={url} title={`Original ${i + 1}`} className="photo-stack-pdf" />
        ) : (
          <a href={url} target="_blank" rel="noreferrer" draggable={false}>
            <img src={url} alt={`Original page ${i + 1}`} draggable={false} />
          </a>
        )}
      </div>
      <div className="photo-stack-nav">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous page">
          ‹
        </button>
        <span>
          {i + 1} of {photos.length}
        </span>
        <button type="button" onClick={() => go(1)} disabled={i === photos.length - 1} aria-label="Next page">
          ›
        </button>
      </div>
      <a className="photo-stack-open" href={url} target="_blank" rel="noreferrer">
        Open full size
      </a>
    </div>
  )
}
