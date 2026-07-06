'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Award, Check, ChevronLeft, FileText, Pencil, PlayCircle, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { CourseContent } from '@/components/courses/course-content'
import { apiGet } from '@/lib/api'
import {
  type CourseDetail,
  type CourseStats,
  courseThumbUrl,
  formatTotalTime,
  levelLabels,
} from '@/lib/courses'

export default function CourseOverviewPage() {
  const params = useParams<{ slug: string }>()
  const { user } = useAuth()
  const [data, setData] = useState<{ course: CourseDetail; stats: CourseStats } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ course: CourseDetail; stats: CourseStats }>(`/courses/${params.slug}`)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [params.slug])

  if (loading) return <p className="text-sm text-muted">Loading…</p>

  if (notFound || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <p className="font-semibold">Course not found</p>
        <Link href="/dashboard/courses" className="mt-3 inline-block text-sm text-accent">
          ← Back to courses
        </Link>
      </div>
    )
  }

  const { course, stats } = data
  const canEdit = user?.role === 'admin' || course.createdBy.id === user?.id
  const thumb = courseThumbUrl(course.thumbnail)
  const instructor = { fullName: course.createdBy.fullName, email: '', avatar: course.createdBy.avatar }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/courses"
          className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
        >
          <ChevronLeft size={16} /> All courses
        </Link>
        {canEdit && (
          <div className="flex items-center gap-3">
            {course.status !== 'published' && (
              <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium capitalize text-muted">
                {course.status}
              </span>
            )}
            <Link
              href={`/dashboard/courses/${course.slug}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-accent/60"
            >
              <Pencil size={15} /> Edit course
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Left: hero + content */}
        <div className="min-w-0 space-y-8">
          <div>
            {course.category && <p className="text-sm font-medium text-accent">{course.category.name}</p>}
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{course.title}</h1>
            {course.subtitle && <p className="mt-3 text-lg text-muted">{course.subtitle}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <span className="rounded-full border border-border px-2.5 py-0.5 capitalize">
                {levelLabels[course.level] ?? course.level}
              </span>
              <span>{stats.studentCount} students</span>
              <span>{course.language}</span>
              <span>
                Updated{' '}
                {new Date(course.updatedAt).toLocaleDateString(undefined, {
                  month: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <Avatar user={instructor} size={28} />
              <span>
                Created by <span className="font-medium">{course.createdBy.fullName ?? 'Instructor'}</span>
              </span>
            </div>
          </div>

          {course.learningOutcomes.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-bold">What you&apos;ll learn</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.learningOutcomes.map((o, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                    <span>{o}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-bold">Course content</h2>
            <p className="mt-1 text-sm text-muted">
              {stats.moduleCount} sections • {stats.lectureCount} lectures •{' '}
              {formatTotalTime(stats.totalDurationSeconds)} total length
            </p>
            <div className="mt-4">
              <CourseContent modules={course.modules} />
            </div>
          </section>

          {course.requirements.length > 0 && (
            <section>
              <h2 className="text-xl font-bold">Requirements</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                {course.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {course.description && (
            <section>
              <h2 className="text-xl font-bold">Description</h2>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                {course.description}
              </div>
            </section>
          )}
        </div>

        {/* Right: sticky enroll card */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="relative aspect-video w-full bg-gradient-to-br from-accent/30 to-accent/5">
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 grid place-items-center bg-black/20">
                <PlayCircle size={56} className="text-white/90" />
              </div>
            </div>
            <div className="p-5">
              <button
                type="button"
                onClick={() => setEnrollMsg('Enrolment is coming in the next slice.')}
                className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition duration-200 hover:opacity-90"
              >
                Enroll now
              </button>
              {enrollMsg && <p className="mt-2 text-center text-xs text-muted">{enrollMsg}</p>}

              <p className="mt-5 font-semibold">This course includes:</p>
              <ul className="mt-3 space-y-2.5 text-sm text-muted">
                <li className="flex items-center gap-3">
                  <Video size={16} /> {formatTotalTime(stats.totalDurationSeconds)} on-demand video
                </li>
                <li className="flex items-center gap-3">
                  <FileText size={16} /> {stats.articleCount} articles
                </li>
                {course.certificateEnabled && (
                  <li className="flex items-center gap-3">
                    <Award size={16} /> Certificate of completion
                  </li>
                )}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
