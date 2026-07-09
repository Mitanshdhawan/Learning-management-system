'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { CourseCard } from '@/components/courses/course-card'
import { apiGet } from '@/lib/api'
import { type CourseSummary } from '@/lib/courses'

export default function CoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<{ courses: CourseSummary[] }>('/courses')
      .then((d) => setCourses(d.courses))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const title = 'All courses'
  const canCreate = user?.role === 'admin' || Boolean(user?.canCreateCourses)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">Browse the catalogue and open a course to see the full details.</p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/courses/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition duration-200 hover:opacity-90"
          >
            <Plus size={16} /> New course
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <p className="text-4xl">📚</p>
          <h2 className="mt-4 font-semibold">No courses yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Published courses will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              canEdit={user?.role === 'admin' || c.createdBy.id === user?.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
