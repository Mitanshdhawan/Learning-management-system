'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Monitor, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiGet } from '@/lib/api'
import { type CourseMedia, mediaUrl } from '@/lib/courses'

interface DetailOption {
  id: string
  optionText: string
  isCorrect: boolean
}

interface DetailQuestion {
  id: string
  questionText: string
  type: string
  points: number
  isCorrect: boolean
  pointsAwarded: number
  selectedOptionIds: string[]
  options: DetailOption[]
}

interface AttemptDetail {
  attempt: {
    id: string
    attemptNumber: number
    score: number | null
    passed: boolean | null
    startedAt: string | null
    submittedAt: string | null
  }
  learner: { id: string; fullName: string; email: string }
  course: { title: string; slug: string }
  test: { id: string; title: string; passingScore: number; sectionTitle: string }
  questions: DetailQuestion[]
  totalPoints: number
  earnedPoints: number
  recordings: { screen: CourseMedia | null; camera: CourseMedia | null }
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * The proctoring footage. There is a single video per attempt: the shared screen,
 * which already has the learner's camera in the corner and their mic on the audio
 * track. Older attempts that only stored camera footage still play here.
 */
function RecordingPanel({ media, isFallback }: { media: CourseMedia | null; isFallback: boolean }) {
  const url = mediaUrl(media)
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Monitor size={13} /> {isFallback ? 'Camera recording' : 'Screen recording (camera & audio included)'}
      </p>
      {url ? (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-lg border border-border bg-black"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
          Not recorded
        </div>
      )}
    </div>
  )
}

/**
 * Reviewer-only breakdown of a single attempt: every question with what the
 * learner picked versus what was correct, the grade, and the proctoring footage.
 */
export function AttemptDetailModal({
  attemptId,
  onClose,
}: {
  attemptId: string
  onClose: () => void
}) {
  const [data, setData] = useState<AttemptDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    apiGet<AttemptDetail>(`/test-attempts/${attemptId}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'Failed to load attempt'))
    return () => {
      alive = false
    }
  }, [attemptId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className="my-auto w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-bold">
                {data ? `Attempt ${data.attempt.attemptNumber} · ${data.test.title}` : 'Attempt'}
              </h2>
              <p className="truncate text-xs text-muted">
                {data
                  ? `${data.learner.fullName} · ${data.course.title} · ${data.test.sectionTitle}`
                  : 'Loading…'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted transition hover:bg-background hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {error ? (
            <p className="px-5 py-10 text-center text-sm text-red-500">{error}</p>
          ) : !data ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Loading attempt…</p>
          ) : (
            <div className="max-h-[72vh] space-y-5 overflow-y-auto px-5 py-4">
              {/* Grade summary */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: 'Score',
                    value: `${data.attempt.score ?? 0}%`,
                  },
                  {
                    label: 'Result',
                    value: data.attempt.passed ? 'Passed' : 'Failed',
                    tone: data.attempt.passed ? 'text-emerald-500' : 'text-red-500',
                  },
                  {
                    label: 'Points',
                    value: `${data.earnedPoints} / ${data.totalPoints}`,
                  },
                  { label: 'Pass mark', value: `${data.test.passingScore}%` },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-background px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted">{s.label}</p>
                    <p className={`text-base font-bold ${s.tone ?? ''}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">
                Started {formatWhen(data.attempt.startedAt)} · Submitted{' '}
                {formatWhen(data.attempt.submittedAt)}
              </p>

              {/* Proctoring footage */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Proctoring recording</h3>
                <RecordingPanel
                  media={data.recordings.screen ?? data.recordings.camera}
                  isFallback={!data.recordings.screen && Boolean(data.recordings.camera)}
                />
              </div>

              {/* Per-question breakdown */}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Answers</h3>
                <div className="space-y-3">
                  {data.questions.map((q, i) => (
                    <div
                      key={q.id}
                      className={`rounded-xl border px-4 py-3 ${
                        q.isCorrect
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-red-500/30 bg-red-500/5'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">
                          {i + 1}. {q.questionText}
                        </p>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            q.isCorrect ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {q.pointsAwarded}/{q.points} pt{q.points === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {q.options.map((o) => {
                          const chosen = q.selectedOptionIds.includes(o.id)
                          return (
                            <li
                              key={o.id}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                                o.isCorrect
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : chosen
                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    : 'text-muted'
                              }`}
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                                {chosen ? <Check size={13} /> : null}
                              </span>
                              <span className="min-w-0 flex-1">{o.optionText}</span>
                              {o.isCorrect && (
                                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide">
                                  correct
                                </span>
                              )}
                              {chosen && !o.isCorrect && (
                                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide">
                                  chosen
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      {q.selectedOptionIds.length === 0 && (
                        <p className="mt-1.5 text-xs text-muted">No answer given.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
