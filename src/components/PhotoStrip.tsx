import { useRef, useState } from 'react'

export type PhotoItem = {
  key: string
  kind: 'image' | 'pdf'
  name: string
  previewUrl: string | null
  status: 'uploading' | 'done' | 'error'
  pathname?: string
  error?: string
}

type Props = {
  photos: PhotoItem[]
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
  onMove: (from: number, to: number) => void
  canAdd: boolean
}

export default function PhotoStrip({ photos, onAdd, onRemove, onMove, canAdd }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  return (
    <div className="photo-strip">
      <ol className="photo-row" aria-label="Recipe photos in page order">
        {photos.map((p, i) => (
          <li
            key={p.key}
            className={[
              'photo-thumb',
              p.status !== 'done' ? `is-${p.status}` : '',
              dragOver === i && dragFrom !== i ? 'is-drop-target' : '',
            ].join(' ')}
            draggable
            onDragStart={(e) => {
              setDragFrom(i)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(i)
            }}
            onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i)
              setDragFrom(null)
              setDragOver(null)
            }}
            onDragEnd={() => {
              setDragFrom(null)
              setDragOver(null)
            }}
          >
            {p.kind === 'image' && p.previewUrl ? (
              <img src={p.previewUrl} alt={`Page ${i + 1}`} draggable={false} />
            ) : (
              <span className="photo-thumb-pdf">PDF</span>
            )}
            <span className="photo-thumb-num">{i + 1}</span>
            {p.status === 'uploading' && <span className="photo-thumb-status">Uploading…</span>}
            {p.status === 'error' && <span className="photo-thumb-status error">{p.error ?? 'Failed'}</span>}
            <button
              type="button"
              className="photo-thumb-remove"
              onClick={() => onRemove(p.key)}
              aria-label={`Remove page ${i + 1}`}
            >
              ✕
            </button>
            {photos.length > 1 && (
              <span className="photo-thumb-move">
                <button
                  type="button"
                  onClick={() => onMove(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move page ${i + 1} earlier`}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, i + 1)}
                  disabled={i === photos.length - 1}
                  aria-label={`Move page ${i + 1} later`}
                >
                  ›
                </button>
              </span>
            )}
          </li>
        ))}
        {canAdd && (
          <li className="photo-add">
            <button type="button" onClick={() => inputRef.current?.click()}>
              <span aria-hidden="true">＋</span>
              {photos.length === 0 ? 'Add photos' : 'Add another photo'}
            </button>
          </li>
        )}
      </ol>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onAdd(files)
        }}
      />
    </div>
  )
}
