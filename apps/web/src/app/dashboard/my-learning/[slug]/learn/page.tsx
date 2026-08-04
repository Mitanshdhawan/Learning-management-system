'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Circle,
  FileText,
  ListChecks,
  Lock,
  PlayCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TestAttemptScreen } from '@/components/courses/test-attempt-screen'
import { apiGet, apiPost } from '@/lib/api'
import {
  type CourseDetail,
  type CourseEnrollment,
  type CourseLesson,
  type CourseStats,
  formatLectureTime,
  formatTotalTime,
  mediaUrl,
} from '@/lib/courses'

interface AttemptsInfo {
  attempts: {
    id: string
    attemptNumber: number
    score: number | null
    passed: boolean | null
    submittedAt: string | null
  }[]
  bestScore: number | null
  passed: boolean
  passingScore: number
  attemptLimit: number | null
  attemptsLeft: number | null
}

export default function LearnPage() {
  const params = useParams<{ slug: string }>()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [passedTests, setPassedTests] = useState<Set<string>>(new Set())
  const [testModuleId, setTestModuleId] = useState<string | null>(null) // section whose test is being taken
  const [testAttempts, setTestAttempts] = useState<Record<string, AttemptsInfo>>({})
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const watchedRef = useRef(0) // seconds of the current video actually watched (skips don't count)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    apiGet<{ course: CourseDetail; stats: CourseStats; enrollment: CourseEnrollment | null }>(
      `/courses/${params.slug}`,
    )
      .then((d) => {
        if (!d.enrollment) {
          setDenied(true)
          return
        }
        setCourse(d.course)
        setCompleted(new Set(d.enrollment.completedLessonIds))
        setPassedTests(new Set(d.enrollment.passedTestIds ?? []))
        const lessons = d.course.modules.flatMap((m) => m.lessons)
        const firstIncomplete = lessons.find((l) => !d.enrollment!.completedLessonIds.includes(l.id))
        const startLesson = firstIncomplete ?? lessons[0]
        setCurrentId(startLesson?.id ?? null)
        // Open only the section that holds the starting lesson.
        const startModule = d.course.modules.find((m) => m.lessons.some((l) => l.id === startLesson?.id))
        setOpenSections(new Set(startModule ? [startModule.id] : []))
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false))
  }, [params.slug])

  const lessons = useMemo(() => (course ? course.modules.flatMap((m) => m.lessons) : []), [course])
  const requiredTests = useMemo(
    () =>
      course
        ? course.modules
            .map((m) => m.test)
            .filter((t): t is NonNullable<typeof t> => Boolean(t) && t!.isRequired)
        : [],
    [course],
  )
  const current = lessons.find((l) => l.id === currentId) ?? null
  // Progress counts completed lessons + passed required tests, matching the server.
  const passedRequired = requiredTests.filter((t) => passedTests.has(t.id)).length
  const totalUnits = lessons.length + requiredTests.length
  const progressPercent =
    totalUnits > 0 ? Math.round(((completed.size + passedRequired) / totalUnits) * 100) : 0

  async function setLessonComplete(lesson: CourseLesson, done: boolean) {
    setCompleted((prev) => {
      const n = new Set(prev)
      if (done) n.add(lesson.id)
      else n.delete(lesson.id)
      return n
    })
    try {
      await apiPost(`/lessons/${lesson.id}/progress`, { completed: done })
    } catch {
      // revert on failure
      setCompleted((prev) => {
        const n = new Set(prev)
        if (done) n.delete(lesson.id)
        else n.add(lesson.id)
        return n
      })
    }
  }

  // Videos complete only after 80% is actually watched — seeking/skipping doesn't count.
  function onVideoTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget
    const delta = v.currentTime - lastTimeRef.current
    if (delta > 0 && delta < 1.5) watchedRef.current += delta
    lastTimeRef.current = v.currentTime
    if (current && !completed.has(current.id) && v.duration > 0 && watchedRef.current >= v.duration * 0.8) {
      setLessonComplete(current, true)
    }
  }

  // A reading (PDF) lecture completes shortly after it's opened.
  useEffect(() => {
    if (!current || current.type !== 'reading' || completed.has(current.id)) return
    const t = setTimeout(() => setLessonComplete(current, true), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  // Load the learner's own attempt history for any expanded section that has a test.
  useEffect(() => {
    if (!course) return
    course.modules.forEach((m) => {
      if (!m.test || !openSections.has(m.id) || testAttempts[m.id]) return
      apiGet<AttemptsInfo>(`/modules/${m.id}/test/attempts`)
        .then((d) => setTestAttempts((prev) => ({ ...prev, [m.id]: d })))
        .catch(() => {})
    })
  }, [course, openSections, testAttempts])

  // Keep only the section of the currently-playing lecture expanded.
  useEffect(() => {
    if (!course || !currentId) return
    const mod = course.modules.find((m) => m.lessons.some((l) => l.id === currentId))
    if (mod) setOpenSections(new Set([mod.id]))
  }, [currentId, course])

  if (loading) return <p className="text-sm text-muted">Loading…</p>

  if (denied || !course) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <p className="font-semibold">You&apos;re not enrolled in this course.</p>
        <Link href="/dashboard/my-learning" className="mt-3 inline-block text-sm text-accent">
          ← My Learning
        </Link>
      </div>
    )
  }

  const currentDone = current ? completed.has(current.id) : false
  const videoUrl = mediaUrl(current?.video ?? null)
  const pdfUrl = current && current.resources.length > 0 ? mediaUrl(current.resources[0].media) : null

  // A required, unpassed section test locks every section after it.
  const firstBlockingIndex = course.modules.findIndex(
    (m) => m.test?.isRequired && !passedTests.has(m.test.id),
  )
  const isLocked = (idx: number) => firstBlockingIndex !== -1 && idx > firstBlockingIndex

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <Link
          href="/dashboard/my-learning"
          className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
        >
          <ChevronLeft size={16} className="shrink-0" /> <span className="truncate">{course.title}</span>
        </Link>
        <span className="shrink-0 text-sm font-medium text-muted">{progressPercent}% complete</span>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-rows-1 lg:grid-cols-[1fr_380px]">
        {/* Player */}
        <div className="flex min-w-0 flex-col lg:min-h-0">
          <div className="bg-black lg:min-h-0 lg:flex-1">
            {current?.type === 'video' && videoUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                key={current.id}
                src={videoUrl}
                controls
                autoPlay
                controlsList="nodownload"
                onLoadedMetadata={() => {
                  watchedRef.current = 0
                  lastTimeRef.current = 0
                }}
                onTimeUpdate={onVideoTimeUpdate}
                onEnded={() => current && !completed.has(current.id) && setLessonComplete(current, true)}
                className="aspect-video max-h-full w-full bg-black lg:aspect-auto lg:h-full lg:object-contain"
              />
            ) : current?.type === 'reading' && pdfUrl ? (
              <iframe
                key={current.id}
                src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                title={current.title}
                className="h-[80vh] w-full bg-white lg:h-full"
              />
            ) : current?.type === 'reading' && current.contentHtml ? (
              <div
                className="h-[80vh] overflow-auto bg-card p-6 text-sm leading-relaxed lg:h-full"
                dangerouslySetInnerHTML={{ __html: current.contentHtml }}
              />
            ) : (
              <div className="grid h-[60vh] w-full place-items-center bg-card text-sm text-muted lg:h-full">
                No content for this lecture yet.
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
            <h1 className="min-w-0 truncate text-base font-bold">{current?.title ?? 'Select a lecture'}</h1>
            {current &&
              (currentDone ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} /> Completed
                </span>
              ) : current.type === 'video' ? (
                <span className="shrink-0 text-xs text-muted">Watch 80% to mark complete</span>
              ) : null)}
          </div>
        </div>

        {/* Course content sidebar */}
        <aside className="flex flex-col border-t border-border lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <h2 className="font-semibold">Course content</h2>
            <p className="mt-0.5 text-xs text-muted">
              {completed.size} / {lessons.length} lectures completed
            </p>
          </div>
          <div className="min-h-0 flex-1 lg:overflow-y-auto">
              {course.modules.map((m, mi) => {
                const done = m.lessons.filter((l) => completed.has(l.id)).length
                const dur = m.lessons.reduce((s, l) => s + (l.videoDurationSeconds ?? 0), 0)
                const open = openSections.has(m.id)
                const locked = isLocked(mi)
                return (
                  <div key={m.id} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSections((prev) => {
                          const n = new Set(prev)
                          if (n.has(m.id)) n.delete(m.id)
                          else n.add(m.id)
                          return n
                        })
                      }
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-background"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {locked && <Lock size={13} className="shrink-0 text-muted" />}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{m.title}</span>
                          <span className="text-xs text-muted">
                            {done} / {m.lessons.length}
                            {dur > 0 && <> · {formatTotalTime(dur)}</>}
                          </span>
                        </span>
                      </span>
                      <ChevronDown size={16} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          key="lessons"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          {m.lessons.map((l) => {
                            const isCurrent = l.id === currentId
                            const isDone = completed.has(l.id)
                            return (
                              <div
                                key={l.id}
                                className={`flex items-start gap-2.5 px-4 py-2.5 transition ${
                                  isCurrent ? 'bg-accent/10' : locked ? '' : 'hover:bg-background'
                                } ${locked ? 'opacity-50' : ''}`}
                              >
                                {locked ? (
                                  <Lock size={16} className="mt-0.5 shrink-0 text-muted/50" />
                                ) : isDone ? (
                                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                                ) : (
                                  <Circle size={16} className="mt-0.5 shrink-0 text-muted/50" />
                                )}
                                <button
                                  type="button"
                                  disabled={locked}
                                  onClick={() => setCurrentId(l.id)}
                                  className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                                >
                                  <span className={`block text-sm ${isCurrent ? 'font-medium text-accent' : ''}`}>
                                    {l.title}
                                  </span>
                                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                    {l.type === 'video' ? <PlayCircle size={12} /> : <FileText size={12} />}
                                    {l.type === 'video' && l.videoDurationSeconds != null
                                      ? formatLectureTime(l.videoDurationSeconds)
                                      : l.type === 'video'
                                        ? 'Video'
                                        : 'Reading'}
                                  </span>
                                </button>
                              </div>
                            )
                          })}

                          {m.test &&
                            (() => {
                              const info = testAttempts[m.id]
                              const isPassed = passedTests.has(m.test.id)
                              const noneLeft = info?.attemptsLeft === 0
                              return (
                                <div className="border-t border-border/60">
                                  <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                                    <span className="flex min-w-0 items-center gap-2.5">
                                      <ListChecks size={16} className="mt-0.5 shrink-0 text-accent" />
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                          {m.test.title}
                                        </span>
                                        <span className="text-xs text-muted">
                                          {m.test._count.questions} question
                                          {m.test._count.questions === 1 ? '' : 's'} ·{' '}
                                          {m.test.isRequired ? 'Required' : 'Optional'}
                                          {info?.attemptLimit != null && (
                                            <> · {info.attempts.length}/{info.attemptLimit} attempts</>
                                          )}
                                        </span>
                                      </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2.5">
                                      {isPassed && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                          <CheckCircle2 size={14} /> Passed
                                        </span>
                                      )}
                                      {/* Retaking is allowed until attempts run out, even after
                                          passing — pass/fail is judged on the best attempt, so a
                                          later attempt can never take the pass away. */}
                                      {noneLeft ? (
                                        !isPassed && (
                                          <span className="text-xs text-muted">No attempts left</span>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={locked}
                                          onClick={() => setTestModuleId(m.id)}
                                          className={
                                            isPassed
                                              ? 'rounded-lg border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-40'
                                              : 'rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40'
                                          }
                                        >
                                          {info && info.attempts.length > 0 ? 'Retake' : 'Take test'}
                                        </button>
                                      )}
                                    </span>
                                  </div>

                                  {info && info.attempts.length > 0 && (
                                    <div className="space-y-1 px-4 pb-2.5 pl-11">
                                      {info.attempts.map((a) => (
                                        <div
                                          key={a.id}
                                          className="flex items-center justify-between gap-2 text-xs"
                                        >
                                          <span className="text-muted">Attempt {a.attemptNumber}</span>
                                          <span
                                            className={
                                              a.passed
                                                ? 'font-medium text-emerald-600 dark:text-emerald-400'
                                                : 'text-red-500'
                                            }
                                          >
                                            {a.score}% · {a.passed ? 'passed' : 'failed'}
                                          </span>
                                        </div>
                                      ))}
                                      {info.bestScore !== null && (
                                        <p className="pt-0.5 text-xs text-muted">
                                          Best {info.bestScore}% · pass mark {info.passingScore}%
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
        </aside>
      </div>

      {testModuleId && (
        <TestAttemptScreen
          moduleId={testModuleId}
          courseSlug={params.slug}
          onClose={() => setTestModuleId(null)}
          onResult={(passed, testId) => {
            if (passed) setPassedTests((prev) => new Set(prev).add(testId))
            // Drop the cached history so the section re-fetches this learner's attempts.
            setTestAttempts((prev) => {
              const next = { ...prev }
              delete next[testModuleId]
              return next
            })
          }}
        />
      )}
    </div>
  )
}
