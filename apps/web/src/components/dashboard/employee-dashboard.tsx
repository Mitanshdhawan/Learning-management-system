'use client'

import Link from 'next/link'
import { BookOpen, GraduationCap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { apiGet } from '@/lib/api'
import { type CourseSummary, courseThumbUrl } from '@/lib/courses'

interface Enrolled {
  id: string
  status: string
  progressPercent: number
  completedLessons: number
  totalLessons: number
  requiredTests: number
  passedRequiredTests: number
  course: CourseSummary
}

/** Compact enrolled-course row for the overview, linking straight into the player. */
function CourseRow({ item }: { item: Enrolled }) {
  const { course, progressPercent, completedLessons, totalLessons, requiredTests, passedRequiredTests } =
    item
  const thumb = courseThumbUrl(course.thumbnail)
  const done = progressPercent >= 100
  const testPending = !done && completedLessons >= totalLessons && passedRequiredTests < requiredTests

  return (
    <Link
      href={`/dashboard/my-learning/${course.slug}/learn`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
    >
      <div className="relative hidden h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-accent/30 to-accent/5 sm:block">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-accent/60">
            <BookOpen size={20} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {course.category && <p className="text-xs font-medium text-accent">{course.category.name}</p>}
            <h3 className="truncate font-semibold transition group-hover:text-accent">{course.title}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <Avatar
                user={{ fullName: course.createdBy.fullName, email: '', avatar: course.createdBy.avatar }}
                size={16}
              />
              <span className="truncate">{course.createdBy.fullName ?? 'Instructor'}</span>
            </div>
          </div>
          <span
            className={`shrink-0 text-sm font-semibold ${
              done ? 'text-emerald-500' : testPending ? 'text-amber-600 dark:text-amber-400' : 'text-accent'
            }`}
          >
            {done ? 'Completed' : testPending ? 'Test pending' : `${progressPercent}%`}
          </span>
        </div>
        <div className="mt-2">
          <div className="mb-1 text-xs text-muted">
            {completedLessons} / {totalLessons} lectures
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                done ? 'bg-emerald-500' : testPending ? 'bg-amber-500' : 'bg-accent'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

export function EmployeeDashboard() {
  const { user } = useAuth()
  const [items, setItems] = useState<Enrolled[] | null>(null)

  useEffect(() => {
    apiGet<{ enrollments: Enrolled[] }>('/enrollments')
      .then((d) => setItems(d.enrollments))
      .catch(() => setItems([]))
  }, [])

  // Derive the tiles from the same data My Learning uses, so the two never drift.
  // "In progress" = enrolled but not yet completed — including courses not started
  // yet, so an assigned-but-untouched course is still counted (never invisible).
  const inProgress = items?.filter((e) => e.progressPercent < 100).length ?? 0
  const completed = items?.filter((e) => e.progressPercent >= 100).length ?? 0
  const certificates =
    items?.filter((e) => e.progressPercent >= 100 && e.course.certificateEnabled).length ?? 0

  const stats = [
    { label: 'In progress', value: inProgress },
    { label: 'Completed', value: completed },
    { label: 'Certificates', value: certificates },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.fullName ?? 'there'} 👋</h1>
        <p className="mt-1 text-sm text-muted">Your learning at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
          >
            <p className="text-3xl font-bold">{items === null ? '—' : s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {items === null ? (
        <p className="text-sm text-muted">Loading your courses…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-4xl">📚</p>
          <h2 className="mt-3 font-semibold">No courses yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            When an admin publishes courses, they&apos;ll show up here for you to enrol in.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <GraduationCap size={18} className="text-accent" /> Continue learning
            </h2>
            <Link href="/dashboard/my-learning" className="text-sm font-medium text-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {items.slice(0, 4).map((e) => (
              <CourseRow key={e.id} item={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
