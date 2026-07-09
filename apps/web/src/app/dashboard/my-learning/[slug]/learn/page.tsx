'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CheckCircle2, ChevronDown, ChevronLeft, Circle, FileText, PlayCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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

export default function LearnPage() {
  const params = useParams<{ slug: string }>()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
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
        const lessons = d.course.modules.flatMap((m) => m.lessons)
        const firstIncomplete = lessons.find((l) => !d.enrollment!.completedLessonIds.includes(l.id))
        setCurrentId((firstIncomplete ?? lessons[0])?.id ?? null)
        setOpenSections(new Set(d.course.modules.map((m) => m.id)))
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false))
  }, [params.slug])

  const lessons = useMemo(() => (course ? course.modules.flatMap((m) => m.lessons) : []), [course])
  const current = lessons.find((l) => l.id === currentId) ?? null
  const progressPercent = lessons.length > 0 ? Math.round((completed.size / lessons.length) * 100) : 0

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
              {course.modules.map((m) => {
                const done = m.lessons.filter((l) => completed.has(l.id)).length
                const dur = m.lessons.reduce((s, l) => s + (l.videoDurationSeconds ?? 0), 0)
                const open = openSections.has(m.id)
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
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{m.title}</span>
                        <span className="text-xs text-muted">
                          {done} / {m.lessons.length}
                          {dur > 0 && <> · {formatTotalTime(dur)}</>}
                        </span>
                      </span>
                      <ChevronDown size={16} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div>
                        {m.lessons.map((l) => {
                          const isCurrent = l.id === currentId
                          const isDone = completed.has(l.id)
                          return (
                            <div
                              key={l.id}
                              className={`flex items-start gap-2.5 px-4 py-2.5 transition ${
                                isCurrent ? 'bg-accent/10' : 'hover:bg-background'
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                              ) : (
                                <Circle size={16} className="mt-0.5 shrink-0 text-muted/50" />
                              )}
                              <button
                                type="button"
                                onClick={() => setCurrentId(l.id)}
                                className="min-w-0 flex-1 text-left"
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
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
        </aside>
      </div>
    </div>
  )
}
