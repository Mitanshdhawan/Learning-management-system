'use client'

import Link from 'next/link'
import { AlertTriangle, BookOpen, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { OverdueTable, StalledList } from '@/components/dashboard/attention-table'
import { ChartCard } from '@/components/dashboard/chart-card'
import { CourseBars } from '@/components/dashboard/charts/course-bars'
import { EnrollmentDonut } from '@/components/dashboard/charts/enrollment-donut'
import { TrendArea } from '@/components/dashboard/charts/trend-area'
import { apiGet } from '@/lib/api'

interface Overview {
  totalUsers: number
  admins: number
  managers: number
  employees: number
  pendingInvites: number
  courses: number
  publishedCourses: number
  enrollments: { total: number; completed: number; inProgress: number; notStarted: number }
  completionRate: number
  activity: {
    totalLearners: number
    activeLast7: number
    activeLast30: number
    dormant: number
    active7: { id: string; name: string }[]
  }
  overdue: { overdueCount: number; items: Parameters<typeof OverdueTable>[0]['items'] }
  stalled: { count: number; items: Parameters<typeof StalledList>[0]['items'] }
  completionsTrend: { weekLabel: string; enrolled: number; completed: number }[]
  topCourses: {
    id: string
    title: string
    slug: string
    enrollments: number
    completed: number
    inProgress: number
    notStarted: number
    completionRate: number
  }[]
}

function KpiTile({
  value,
  label,
  sub,
  alert,
}: {
  value: number | string
  label: string
  sub?: string
  alert?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        alert ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card hover:border-accent/40'
      }`}
    >
      <p className={`flex items-center gap-1.5 text-3xl font-bold ${alert ? 'text-red-500' : ''}`}>
        {alert && <AlertTriangle size={22} />}
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted/70">{sub}</p>}
    </div>
  )
}

export function AdminDashboard() {
  const { user } = useAuth()
  const [ov, setOv] = useState<Overview | null>(null)

  useEffect(() => {
    apiGet<Overview>('/admin/overview')
      .then(setOv)
      .catch(() => {})
  }, [])

  const loading = !ov

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.fullName ?? 'Admin'}</h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening in your organisation.</p>
      </div>

      {/* GLANCE — headline KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Organisation — total / managers / employees */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Organisation</h2>
            <Link href="/dashboard/users" className="text-xs font-medium text-accent hover:underline">
              Manage →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-3xl font-bold">{ov ? ov.totalUsers : '—'}</p>
              <p className="mt-0.5 text-xs text-muted">Total users</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{ov ? ov.managers : '—'}</p>
              <p className="mt-0.5 text-xs text-muted">Managers</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{ov ? ov.employees : '—'}</p>
              <p className="mt-0.5 text-xs text-muted">Employees</p>
            </div>
          </div>
          {ov && ov.totalUsers > 0 && (
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-border" aria-hidden>
              <div className="bg-accent" style={{ width: `${(ov.admins / ov.totalUsers) * 100}%` }} title="Admins" />
              <div className="bg-amber-500" style={{ width: `${(ov.managers / ov.totalUsers) * 100}%` }} title="Managers" />
              <div className="bg-emerald-500" style={{ width: `${(ov.employees / ov.totalUsers) * 100}%` }} title="Employees" />
            </div>
          )}
          {ov && (
            <p className="mt-2 text-xs text-muted">
              {ov.pendingInvites} pending invite{ov.pendingInvites === 1 ? '' : 's'} · {ov.publishedCourses}/
              {ov.courses} courses published
            </p>
          )}
        </div>
        
        <KpiTile
          value={ov ? `${ov.completionRate}%` : '—'}
          label="Completion rate"
          sub={ov ? `${ov.enrollments.total} enrolments` : undefined}
        />

        {/* Active this week — hover to see who */}
        <div className="group relative rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg">
          <p className="text-3xl font-bold">{ov ? ov.activity.activeLast7 : '—'}</p>
          <p className="mt-1 text-xs font-medium text-muted">Active this week</p>
          {ov && (
            <p className="mt-0.5 text-xs text-muted/70">
              of {ov.activity.totalLearners} learners · {ov.activity.dormant} dormant
            </p>
          )}
          {ov && ov.activity.active7.length > 0 && (
            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-border bg-card p-3 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
              <p className="mb-1.5 text-xs font-semibold text-muted">Active in the last 7 days</p>
              <ul className="space-y-1 text-sm">
                {ov.activity.active7.slice(0, 10).map((u) => (
                  <li key={u.id} className="truncate">
                    {u.name}
                  </li>
                ))}
              </ul>
              {ov.activity.activeLast7 > 10 && (
                <p className="mt-1.5 text-xs text-muted">+{ov.activity.activeLast7 - 10} more</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ANALYSE — learning health */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Enrolment status"
          height={200}
          loading={loading}
          empty={!!ov && ov.enrollments.total === 0}
          emptyText="No enrolments yet. Assign a course to get started."
        >
          {ov && (
            <EnrollmentDonut
              completed={ov.enrollments.completed}
              inProgress={ov.enrollments.inProgress}
              notStarted={ov.enrollments.notStarted}
              centerLabel={`${ov.completionRate}%`}
            />
          )}
        </ChartCard>

        <ChartCard title="Enrolments vs completions · last 8 weeks" height={220} loading={loading}>
          {ov && <TrendArea data={ov.completionsTrend} />}
        </ChartCard>
      </div>

      {/* ACT — needs attention */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <AlertTriangle size={18} className="text-red-500" /> Overdue mandatory training
          </h2>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <OverdueTable items={ov.overdue.items} total={ov.overdue.overdueCount} showManager />
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Users size={18} className="text-amber-500" /> Stalled learners
          </h2>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <StalledList items={ov.stalled.items} total={ov.stalled.count} />
          )}
        </div>
      </div>

      {/* Course performance */}
      <ChartCard
        title="Course performance"
        height={ov && ov.topCourses.length ? Math.max(160, ov.topCourses.length * 46 + 40) : 200}
        loading={loading}
        empty={!!ov && ov.topCourses.length === 0}
        emptyText="No published-course enrolments yet."
      >
        {ov && <CourseBars data={ov.topCourses} />}
      </ChartCard>

      {/* NAVIGATE — quick actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/users"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent transition group-hover:scale-110">
            <Users size={20} />
          </span>
          <div>
            <p className="font-semibold">Manage users</p>
            <p className="text-sm text-muted">Invite, search and organise people.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/courses"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent transition group-hover:scale-110">
            <BookOpen size={20} />
          </span>
          <div>
            <p className="font-semibold">Courses</p>
            <p className="text-sm text-muted">Build and publish learning content.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
