'use client'

import { useAuth } from '@/components/auth-provider'

const stats = [
  { label: 'In progress', value: 0 },
  { label: 'Completed', value: 0 },
  { label: 'Certificates', value: 0 },
]

export function EmployeeDashboard() {
  const { user } = useAuth()

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
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <p className="text-4xl">📚</p>
        <h2 className="mt-3 font-semibold">No courses yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          When an admin publishes courses, they&apos;ll show up here for you to enrol in.
        </p>
      </div>
    </div>
  )
}
