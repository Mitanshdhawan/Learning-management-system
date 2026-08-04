'use client'

import Link from 'next/link'
import { AlertTriangle, BookOpen, GraduationCap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { apiGet } from '@/lib/api'
import { type CourseSummary, courseThumbUrl } from '@/lib/courses'

interface Enrolled {
  id: string
  status: string
  isMandatory: boolean
  dueDate: string | null
  progressPercent: number
  completedLessons: number
  totalLessons: number
  requiredTests: number
  passedRequiredTests: number
  course: CourseSummary
}

type Filter = 'all' | 'mandatory'

function fmtDue(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function EnrolledCard({ item }: { item: Enrolled }) {
  const {
    course,
    progressPercent,
    completedLessons,
    totalLessons,
    requiredTests,
    passedRequiredTests,
    isMandatory,
    dueDate,
  } = item
  const thumb = courseThumbUrl(course.thumbnail)
  const done = progressPercent >= 100
  const overdue = isMandatory && !done && dueDate ? new Date(dueDate).getTime() < Date.now() : false
  // All lectures watched but a required test still stands between them and completion.
  const testPending = !done && completedLessons >= totalLessons && passedRequiredTests < requiredTests

  return (
    <Link
      href={`/dashboard/my-learning/${course.slug}/learn`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-accent/30 to-accent/5">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-accent/60">
            <BookOpen size={40} />
          </div>
        )}
        {isMandatory && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/95 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            Mandatory
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {course.category && <p className="text-xs font-medium text-accent">{course.category.name}</p>}
        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{course.title}</h3>
        {isMandatory && dueDate && (
          <p
            className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium ${
              overdue ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {overdue && <AlertTriangle size={12} className="shrink-0" />}
            {done ? 'Completed' : `Due ${fmtDue(dueDate)}${overdue ? ' · overdue' : ''}`}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Avatar
            user={{ fullName: course.createdBy.fullName, email: '', avatar: course.createdBy.avatar }}
            size={20}
          />
          <span className="truncate">{course.createdBy.fullName ?? 'Instructor'}</span>
        </div>

        <div className="mt-auto pt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">
              {completedLessons} / {totalLessons} lectures
            </span>
            <span
              className={`font-semibold ${
                done ? 'text-emerald-500' : testPending ? 'text-amber-600 dark:text-amber-400' : 'text-accent'
              }`}
            >
              {done ? 'Completed' : testPending ? 'Test pending' : `${progressPercent}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                done ? 'bg-emerald-500' : testPending ? 'bg-amber-500' : 'bg-accent'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="mt-3 inline-block text-sm font-medium text-accent transition group-hover:underline">
            {done
              ? 'Review course →'
              : testPending
                ? 'Take the test →'
                : progressPercent > 0
                  ? 'Continue learning →'
                  : 'Start course →'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function MyLearningPage() {
  const [items, setItems] = useState<Enrolled[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    apiGet<{ enrollments: Enrolled[] }>('/enrollments')
      .then((d) => setItems(d.enrollments))
      .catch(() => setItems([]))
  }, [])

  const mandatoryCount = useMemo(() => items?.filter((e) => e.isMandatory).length ?? 0, [items])
  const visible = useMemo(
    () => (items ?? []).filter((e) => (filter === 'mandatory' ? e.isMandatory : true)),
    [items, filter],
  )

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All courses' },
    { key: 'mandatory', label: `Mandatory${mandatoryCount ? ` (${mandatoryCount})` : ''}` },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Learning</h1>
        <p className="mt-1 text-sm text-muted">Courses you&apos;re enrolled in - pick up where you left off.</p>
      </div>

      {/* Only worth showing the filter once there's a mandatory course to filter to. */}
      {items && items.length > 0 && mandatoryCount > 0 && (
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition duration-200 ${
                filter === f.key ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {items === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <GraduationCap size={40} className="mx-auto text-accent/50" />
          <h2 className="mt-4 font-semibold">You haven&apos;t enrolled in any courses yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Browse the catalogue and enrol to start learning.
          </p>
          <Link
            href="/dashboard/courses"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Browse courses
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">
          No mandatory courses assigned to you.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e) => (
            <EnrolledCard key={e.id} item={e} />
          ))}
        </div>
      )}
    </div>
  )
}
