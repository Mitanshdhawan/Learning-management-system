'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Select } from '@/components/ui/select'
import { apiDelete, apiGet, apiPut } from '@/lib/api'
import type { CourseModuleTest } from '@/lib/courses'

type QType = 'single_choice' | 'multiple_choice' | 'true_false'
interface EOpt {
  text: string
  isCorrect: boolean
}
interface EQ {
  type: QType
  questionText: string
  points: number
  options: EOpt[]
}

const TYPE_OPTIONS = [
  { value: 'single_choice', label: 'Single choice (MCQ)' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
]

function blankQuestion(type: QType = 'single_choice'): EQ {
  if (type === 'true_false')
    return {
      type,
      questionText: '',
      points: 1,
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    }
  return {
    type,
    questionText: '',
    points: 1,
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
  }
}

export function TestEditorModal({
  moduleId,
  moduleTitle,
  onClose,
  onSaved,
}: {
  moduleId: string
  moduleTitle: string
  onClose: () => void
  onSaved: (test: CourseModuleTest | null) => void
}) {
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState(false)
  const [title, setTitle] = useState('')
  const [isRequired, setIsRequired] = useState(true)
  const [passingScore, setPassingScore] = useState(70)
  const [maxAttempts, setMaxAttempts] = useState<number | ''>('')
  const [questions, setQuestions] = useState<EQ[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    apiGet<{ test: TestFull | null }>(`/modules/${moduleId}/test`)
      .then((d) => {
        if (d.test) {
          setExisting(true)
          setTitle(d.test.title)
          setIsRequired(d.test.isRequired)
          setPassingScore(d.test.passingScore)
          setMaxAttempts(d.test.maxAttempts ?? '')
          setQuestions(
            d.test.questions.map((q) => ({
              type: q.type,
              questionText: q.questionText,
              points: q.points,
              options: (q.options ?? []).map((o) => ({ text: o.optionText, isCorrect: o.isCorrect })),
            })),
          )
        } else {
          setTitle(`${moduleTitle} — Quiz`)
          setQuestions([blankQuestion()])
        }
      })
      .catch(() => {
        setTitle(`${moduleTitle} — Quiz`)
        setQuestions([blankQuestion()])
      })
      .finally(() => setLoading(false))
  }, [moduleId, moduleTitle])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  function patchQ(i: number, patch: Partial<EQ>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }
  function changeType(i: number, type: QType) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === i ? { ...blankQuestion(type), questionText: q.questionText, points: q.points } : q,
      ),
    )
  }
  function patchOpt(qi: number, oi: number, patch: Partial<EOpt>) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : q,
      ),
    )
  }
  function setSingleCorrect(qi: number, oi: number) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oi })) } : q,
      ),
    )
  }
  function addOption(qi: number) {
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === qi ? { ...q, options: [...q.options, { text: '', isCorrect: false }] } : q)),
    )
  }
  function removeOption(qi: number, oi: number) {
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q)),
    )
  }

  const valid =
    title.trim().length > 0 &&
    questions.length > 0 &&
    questions.every((q) => {
      if (!q.questionText.trim()) return false
      if (q.options.length < 2 || q.options.some((o) => !o.text.trim())) return false
      const correct = q.options.filter((o) => o.isCorrect).length
      if (correct < 1) return false
      if ((q.type === 'single_choice' || q.type === 'true_false') && correct !== 1) return false
      return true
    })

  async function save() {
    setError(null)
    setBusy(true)
    try {
      const d = await apiPut<{ test: TestFull }>(`/modules/${moduleId}/test`, {
        title: title.trim(),
        isRequired,
        passingScore,
        maxAttempts: maxAttempts === '' ? null : Number(maxAttempts),
        questions: questions.map((q) => ({
          type: q.type,
          questionText: q.questionText.trim(),
          points: q.points,
          options: q.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
        })),
      })
      onSaved({
        id: d.test.id,
        title: d.test.title,
        isRequired: d.test.isRequired,
        passingScore: d.test.passingScore,
        _count: { questions: d.test.questions.length },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the test')
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await apiDelete(`/modules/${moduleId}/test`)
      onSaved(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the test')
      setBusy(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
          className="my-auto w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-bold">Section test</h2>
              <p className="text-xs text-muted">{moduleTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => !busy && onClose()}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted transition hover:bg-background hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Loading…</p>
          ) : (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {error}
                </p>
              )}

              {/* Test settings */}
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Test title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Passing %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={passingScore}
                    onChange={(e) => setPassingScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Max attempts</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxAttempts}
                    placeholder="∞"
                    onChange={(e) =>
                      setMaxAttempts(e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Required
                </label>
              </div>
              <p className="-mt-2 text-xs text-muted">
                Leave max attempts blank for unlimited. Pass/fail uses the learner&apos;s best attempt.
              </p>
              {isRequired && (
                <p className="-mt-2 text-xs text-muted">
                  Learners must pass this test before the next section and to complete the course.
                </p>
              )}

              {/* Questions */}
              {questions.map((q, qi) => (
                <div key={qi} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Question {qi + 1}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-44">
                        <Select
                          ariaLabel={`Question ${qi + 1} type`}
                          value={q.type}
                          onChange={(v) => changeType(qi, v as QType)}
                          options={TYPE_OPTIONS}
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={q.points}
                        title="Points"
                        onChange={(e) => patchQ(qi, { points: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-16 rounded-lg border border-border bg-card px-2 py-2 text-sm outline-none transition focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}
                        disabled={questions.length <= 1}
                        aria-label="Remove question"
                        className="rounded-lg p-1.5 text-muted transition hover:text-red-500 disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={q.questionText}
                    onChange={(e) => patchQ(qi, { questionText: e.target.value })}
                    placeholder="Question text…"
                    rows={2}
                    className="mt-3 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-accent"
                  />

                  <div className="mt-3 space-y-2">
                      {q.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type={q.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                            name={`correct-${qi}`}
                            checked={o.isCorrect}
                            title="Mark correct"
                            onChange={() =>
                              q.type === 'multiple_choice'
                                ? patchOpt(qi, oi, { isCorrect: !o.isCorrect })
                                : setSingleCorrect(qi, oi)
                            }
                            className="h-4 w-4 shrink-0 accent-accent"
                          />
                          <input
                            value={o.text}
                            onChange={(e) => patchOpt(qi, oi, { text: e.target.value })}
                            disabled={q.type === 'true_false'}
                            placeholder={`Option ${oi + 1}`}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none transition focus:border-accent disabled:opacity-70"
                          />
                          {q.type !== 'true_false' && q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(qi, oi)}
                              aria-label="Remove option"
                              className="rounded p-1 text-muted transition hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {q.type !== 'true_false' && q.options.length < 10 && (
                        <button
                          type="button"
                          onClick={() => addOption(qi)}
                          className="text-xs font-medium text-accent transition hover:underline"
                        >
                          + Add option
                        </button>
                      )}
                      <p className="text-xs text-muted">
                        {q.type === 'multiple_choice'
                          ? 'Tick every correct option.'
                          : 'Select the one correct option.'}
                      </p>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-muted transition hover:border-accent/60 hover:text-foreground"
              >
                <Plus size={15} /> Add question
              </button>
            </div>
          )}

          {/* Footer */}
          {!loading && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
              <div>
                {existing &&
                  (confirmDelete ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-muted">Delete test?</span>
                      <button
                        type="button"
                        onClick={remove}
                        disabled={busy}
                        className="font-medium text-red-500 hover:underline disabled:opacity-50"
                      >
                        Yes, delete
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="text-muted hover:underline">
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={busy}
                      className="text-sm font-medium text-red-500 transition hover:underline disabled:opacity-50"
                    >
                      Delete test
                    </button>
                  ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => !busy && onClose()}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !valid}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save test'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

interface TestFull {
  id: string
  title: string
  isRequired: boolean
  passingScore: number
  maxAttempts: number | null
  questions: {
    type: QType
    questionText: string
    points: number
    options: { optionText: string; isCorrect: boolean }[]
  }[]
}
