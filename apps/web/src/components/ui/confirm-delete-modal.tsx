'use client'

import { motion } from 'framer-motion'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  /** The exact text the user must type to enable deletion (e.g. the course title or an email). */
  confirmText: string
  /** Placeholder / label describing what to type, e.g. "Course name" or "Your email". */
  confirmHint?: string
  description?: React.ReactNode
  confirmLabel?: string
  onCancel: () => void
  /** Perform the deletion. Throw to surface an error and keep the modal open. */
  onConfirm: () => Promise<void> | void
}

export function ConfirmDeleteModal({
  title,
  confirmText,
  confirmHint = 'Type here',
  description,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}: Props) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const matches = value.trim() === confirmText.trim()

  async function confirm() {
    if (!matches || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      // On success the parent unmounts this modal (navigation / list refresh).
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
      setBusy(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => !busy && onCancel()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/30"
      >
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-500">
            <TriangleAlert size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">
              {description ?? 'This action is permanent and cannot be undone.'}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm text-muted">
            Type{' '}
            <span className="select-all break-all font-semibold text-foreground">{confirmText}</span>{' '}
            to confirm.
          </p>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirm()}
            placeholder={confirmHint}
            disabled={busy}
            autoComplete="off"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-red-500 disabled:opacity-60"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-background disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!matches || busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
