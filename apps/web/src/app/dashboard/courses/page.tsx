'use client'

import { BookOpen } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

export default function CoursesPage() {
  const { user } = useAuth()
  const title = user?.role === 'employee' ? 'My courses' : 'All courses'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">Course management is coming next.</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
        <BookOpen className="mx-auto text-muted" size={40} />
        <h2 className="mt-4 font-semibold">No courses yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Courses, modules, lessons, quizzes and certificates will live here.
        </p>
      </div>
    </div>
  )
}
