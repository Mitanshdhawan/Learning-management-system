'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** In-app viewer — plays a video or renders a PDF inside a modal (never a new tab). */
export function MediaViewerModal({
  url,
  kind,
  title,
  onClose,
}: {
  url: string
  kind: 'video' | 'document'
  title: string
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="truncate text-sm font-medium">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="rounded-lg p-1.5 text-muted transition hover:bg-background hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {kind === 'video' ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={url} controls autoPlay className="max-h-[78vh] w-full bg-black" />
          ) : (
            <iframe src={url} title={title} className="h-[78vh] w-full bg-white" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
