'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FileText, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { type CourseModule, formatLectureTime, formatTotalTime, moduleDuration } from '@/lib/courses'

export function CourseContent({ modules }: { modules: CourseModule[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(modules[0] ? [modules[0].id] : []))

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (modules.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted">
        No content has been added yet.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {modules.map((m) => {
        const isOpen = open.has(m.id)
        return (
          <div key={m.id}>
            <button
              type="button"
              onClick={() => toggle(m.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition duration-150 hover:bg-background"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
                <span className="truncate font-semibold">{m.title}</span>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {m.lessons.length} lectures • {formatTotalTime(moduleDuration(m.lessons))}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <ul className="border-t border-border">
                    {m.lessons.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-3 py-2.5 pl-12 pr-5 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {l.type === 'video' ? (
                            <PlayCircle size={16} className="shrink-0 text-muted" />
                          ) : (
                            <FileText size={16} className="shrink-0 text-muted" />
                          )}
                          <span className="truncate">{l.title}</span>
                          {l.isPreview && (
                            <span className="shrink-0 rounded border border-accent/40 px-1.5 py-0.5 text-xs text-accent">
                              Preview
                            </span>
                          )}
                        </div>
                        {l.videoDurationSeconds ? (
                          <span className="shrink-0 text-xs text-muted">
                            {formatLectureTime(l.videoDurationSeconds)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
