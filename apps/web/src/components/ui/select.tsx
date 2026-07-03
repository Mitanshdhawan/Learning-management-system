'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  const selected = options.find((o) => o.value === value)

  function toggle() {
    if (disabled) return
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

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none transition duration-200 ${
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-accent/60'
        } ${open ? 'border-accent' : 'border-border'}`}
      >
        <span className={`truncate ${selected ? '' : 'text-muted'}`}>
          {selected?.label ?? placeholder}
        </span>
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
                <motion.ul
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
                  className="z-[100] max-h-60 overflow-auto rounded-xl border border-border bg-card p-1 shadow-2xl shadow-black/30"
                >
                  {options.map((o) => {
                    const active = o.value === value
                    return (
                      <li key={o.value}>
                        <button
                          type="button"
                          onClick={() => {
                            onChange(o.value)
                            setOpen(false)
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition duration-150 ${
                            active
                              ? 'bg-accent/15 font-medium text-accent'
                              : 'text-foreground hover:bg-background'
                          }`}
                        >
                          <span className="truncate">{o.label}</span>
                          {active && <Check size={15} className="shrink-0" />}
                        </button>
                      </li>
                    )
                  })}
                </motion.ul>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
