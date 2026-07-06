'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiPost } from '@/lib/api'

export interface Category {
  id: string
  name: string
}

interface Props {
  value: string // category id, or '' for "No category"
  onChange: (id: string) => void
  categories: Category[]
  onCategoryCreated: (category: Category) => void
  allowCreate?: boolean
  className?: string
}

export function CategoryPicker({
  value,
  onChange,
  categories,
  onCategoryCreated,
  allowCreate = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  const selected = categories.find((c) => c.id === value)

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setRect({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reset the "add new" state whenever the menu closes.
  useEffect(() => {
    if (!open) {
      setAdding(false)
      setNewName('')
      setError(null)
    }
  }, [open])

  async function createCategory() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const { category } = await apiPost<{ category: Category }>('/categories', { name })
      onCategoryCreated(category)
      onChange(category.id)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none transition duration-200 hover:border-accent/60 ${
          open ? 'border-accent' : 'border-border'
        }`}
      >
        <span className={`truncate ${selected ? '' : 'text-muted'}`}>{selected?.name ?? 'No category'}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && rect && (
              <>
                <div className="fixed inset-0 z-[90]" onMouseDown={() => setOpen(false)} />
                <motion.div
                  role="listbox"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{
                    position: 'fixed',
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    transformOrigin: 'top',
                  }}
                  className="z-[100] overflow-hidden rounded-xl border border-border bg-card p-1 shadow-2xl shadow-black/30"
                >
                  <ul className="max-h-56 overflow-auto">
                    <li>
                      <Option
                        active={value === ''}
                        label="No category"
                        muted
                        onClick={() => {
                          onChange('')
                          setOpen(false)
                        }}
                      />
                    </li>
                    {categories.map((c) => (
                      <li key={c.id}>
                        <Option
                          active={c.id === value}
                          label={c.name}
                          onClick={() => {
                            onChange(c.id)
                            setOpen(false)
                          }}
                        />
                      </li>
                    ))}
                  </ul>

                  {allowCreate &&
                    (adding ? (
                      <div className="mt-1 border-t border-border p-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                createCategory()
                              }
                            }}
                            placeholder="New category name"
                            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                          />
                          <button
                            type="button"
                            onClick={createCategory}
                            disabled={busy || !newName.trim()}
                            className="rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                          >
                            {busy ? '…' : 'Add'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdding(false)
                              setNewName('')
                              setError(null)
                            }}
                            aria-label="Cancel"
                            className="rounded-md p-1.5 text-muted transition hover:text-foreground"
                          >
                            <X size={15} />
                          </button>
                        </div>
                        {error && <p className="mt-1 px-0.5 text-xs text-red-500">{error}</p>}
                      </div>
                    ) : (
                      <div className="mt-1 border-t border-border pt-1">
                        <button
                          type="button"
                          onClick={() => setAdding(true)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-accent transition hover:bg-accent/10"
                        >
                          <Plus size={15} /> New category
                        </button>
                      </div>
                    ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}

function Option({
  active,
  label,
  onClick,
  muted,
}: {
  active: boolean
  label: string
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition duration-150 ${
        active ? 'bg-accent/15 font-medium text-accent' : `hover:bg-background ${muted ? 'text-muted' : 'text-foreground'}`
      }`}
    >
      <span className="truncate">{label}</span>
      {active && <Check size={15} className="shrink-0" />}
    </button>
  )
}
