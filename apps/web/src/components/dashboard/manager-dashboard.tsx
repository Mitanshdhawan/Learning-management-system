'use client'

import { AlertTriangle, ClipboardCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { OverdueTable } from '@/components/dashboard/attention-table'
import { ChartCard } from '@/components/dashboard/chart-card'
import { EnrollmentDonut } from '@/components/dashboard/charts/enrollment-donut'
import { MemberBars } from '@/components/dashboard/charts/member-bars'
import { Select } from '@/components/ui/select'
import { apiGet, apiPost } from '@/lib/api'
import type { CourseSummary } from '@/lib/courses'

interface Member {
  id: string
  fullName: string | null
  email: string
  avatar: { storageKey: string; provider: string } | null
  courseCount: number
  completedCourses: number
  inProgress: number
  notStarted: number
  avgProgress: number
  overdueMandatory: number
  lastActivityAt: string | null
}

interface TeamOverview {
  teamSize: number
  aggregate: {
    avgProgress: number
    totalCompleted: number
    overdueMandatory: number
    enrollments: { completed: number; inProgress: number; notStarted: number; total: number }
  }
  overdue: Parameters<typeof OverdueTable>[0]['items']
  members: Member[]
}

function KpiTile({ value, label, alert }: { value: number | string; label: string; alert?: boolean }) {
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
    </div>
  )
}

export function ManagerDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<TeamOverview | null>(null)
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])

  const [memberId, setMemberId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    apiGet<TeamOverview>('/team/overview')
      .then(setData)
      .catch(() =>
        setData({
          teamSize: 0,
          aggregate: { avgProgress: 0, totalCompleted: 0, overdueMandatory: 0, enrollments: { completed: 0, inProgress: 0, notStarted: 0, total: 0 } },
          overdue: [],
          members: [],
        }),
      )
  }, [])

  useEffect(() => {
    load()
    apiGet<{ courses: CourseSummary[] }>('/courses')
      .then((d) => setCourses(d.courses.filter((c) => c.status === 'published').map((c) => ({ id: c.id, title: c.title }))))
      .catch(() => setCourses([]))
  }, [load])

  async function assign() {
    if (!memberId || !courseId) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      await apiPost(`/team/${memberId}/assign`, { courseId, dueDate: due || null })
      const who = data?.members.find((m) => m.id === memberId)
      setMsg(`Assigned to ${who?.fullName ?? 'the team member'}.`)
      setCourseId('')
      setDue('')
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not assign the course')
    } finally {
      setBusy(false)
    }
  }

  const agg = data?.aggregate
  const hasTeam = (data?.teamSize ?? 0) > 0
  const loading = !data
  const teamCompletion =
    agg && agg.enrollments.total > 0 ? Math.round((agg.enrollments.completed / agg.enrollments.total) * 100) : 0
  // One height for both status cards so the donut and member bars line up.
  const chartH = Math.max(220, (data?.members.length ?? 0) * 46 + 40)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.fullName ?? 'Manager'}</h1>
        <p className="mt-1 text-sm text-muted">Keep your team learning and on track.</p>
      </div>

      {/* GLANCE — team KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <KpiTile value={data ? data.teamSize : '—'} label="Team members" />
        <KpiTile value={agg ? `${agg.avgProgress}%` : '—'} label="Avg. progress" />
      </div>

      {!hasTeam && !loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted shadow-sm">
          No one reports to you yet. Once team members are assigned to you, their progress shows up here.
        </div>
      ) : (
        <>
          {/* ANALYSE — team status (both cards share one height so they align cleanly) */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Team enrolment status"
              height={chartH}
              loading={loading}
              empty={!!agg && agg.enrollments.total === 0}
              emptyText="No enrolments yet — assign a course below to get started."
            >
              {agg && (
                <EnrollmentDonut
                  completed={agg.enrollments.completed}
                  inProgress={agg.enrollments.inProgress}
                  notStarted={agg.enrollments.notStarted}
                  centerLabel={`${teamCompletion}%`}
                />
              )}
            </ChartCard>

            <ChartCard title="Member progress" height={chartH} loading={loading}>
              {data && <MemberBars members={data.members} />}
            </ChartCard>
          </div>

          {/* ACT — overdue */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <AlertTriangle size={18} className="text-red-500" /> Overdue mandatory training
            </h2>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <OverdueTable items={data.overdue} total={data.overdue.length} />
            )}
          </div>
        </>
      )}

      {/* ACT — assign a course */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <ClipboardCheck size={18} className="text-accent" /> Assign a course
        </h2>
        <p className="mt-1 text-sm text-muted">
          Make a published course mandatory for a team member, with an optional due date.
        </p>

        {!hasTeam ? (
          <p className="mt-4 text-sm text-muted">Add team members to start assigning courses.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted">Team member</label>
              <Select
                ariaLabel="Team member"
                placeholder="Choose…"
                value={memberId}
                onChange={setMemberId}
                options={(data?.members ?? []).map((m) => ({ value: m.id, label: m.fullName ?? m.email }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Course</label>
              <Select
                ariaLabel="Course"
                placeholder={courses.length ? 'Choose…' : 'No published courses'}
                value={courseId}
                onChange={setCourseId}
                options={courses.map((c) => ({ value: c.id, label: c.title }))}
                disabled={courses.length === 0}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Due date (optional)</label>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={assign}
              disabled={busy || !memberId || !courseId}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Assigning…' : 'Assign as mandatory'}
            </button>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>}
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
      </div>
    </div>
  )
}
