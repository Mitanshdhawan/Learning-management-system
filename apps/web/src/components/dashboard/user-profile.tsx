'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, ChevronLeft, Pencil, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, type AuthUser } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import { Select } from '@/components/ui/select'
import { apiDelete, apiGet, apiPatch } from '@/lib/api'
import { type CourseSummary, courseThumbUrl } from '@/lib/courses'

interface MemberUser {
  id: string
  email: string
  fullName: string | null
  role: 'admin' | 'manager' | 'employee'
  status: string
  canCreateCourses: boolean
  managerId: string | null
  createdAt: string
  avatar: { storageKey: string; provider: string } | null
  manager: { id: string; fullName: string | null; email: string } | null
}

interface MemberEnrollment {
  id: string
  status: string
  progressPercent: number
  totalLessons: number
  completedLessons: number
  completedAt: string | null
  updatedAt: string
  course: CourseSummary
}

interface Report {
  user: MemberUser
  enrollments: MemberEnrollment[]
  stats: { courseCount: number; completedCourses: number; inProgress: number; avgProgress: number }
}

const roleBadge: Record<string, string> = {
  admin: 'border-accent/40 bg-accent/10 text-accent',
  manager: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  employee: 'border-border bg-background text-muted',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function ProgressRow({ e }: { e: MemberEnrollment }) {
  const thumb = courseThumbUrl(e.course.thumbnail)
  const done = e.status === 'completed'
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
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
            {e.course.category && <p className="text-xs font-medium text-accent">{e.course.category.name}</p>}
            <Link
              href={`/dashboard/courses/${e.course.slug}`}
              className="block truncate font-semibold transition hover:text-accent"
            >
              {e.course.title}
            </Link>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
              done
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                : e.status === 'in_progress'
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border bg-background text-muted'
            }`}
          >
            {e.status.replace('_', ' ')}
          </span>
        </div>
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">
              {e.completedLessons} / {e.totalLessons} lectures
            </span>
            <span className={`font-semibold ${done ? 'text-emerald-500' : 'text-accent'}`}>
              {e.progressPercent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : 'bg-accent'}`}
              style={{ width: `${e.progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function UserProfile({
  userId,
  backHref,
  backLabel,
}: {
  userId: string
  backHref: string
  backLabel: string
}) {
  const { user: me } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  // Edit-mode form state (staged, then committed together via "Save details")
  const [managers, setManagers] = useState<AuthUser[]>([])
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'manager' | 'employee'>('employee')
  const [reportsTo, setReportsTo] = useState('')
  const [canCreate, setCanCreate] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const canEdit = me?.role === 'admin'

  const load = useCallback(async () => {
    try {
      const d = await apiGet<Report>(`/team/${userId}`)
      setData(d)
      setName(d.user.fullName ?? '')
      setRole(d.user.role)
      setReportsTo(d.user.managerId ?? '')
      setCanCreate(d.user.canCreateCourses)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this member')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!editing || !canEdit) return
    apiGet<{ users: AuthUser[] }>('/users')
      .then((d) => setManagers(d.users.filter((u) => u.role === 'manager' || u.role === 'admin')))
      .catch(() => {})
  }, [editing, canEdit])

  async function saveDetails() {
    if (!data) return
    const u = data.user
    const patch: Record<string, unknown> = {}
    if (name.trim() !== (u.fullName ?? '')) patch.fullName = name.trim()
    if (role !== u.role) patch.role = role
    if ((reportsTo || null) !== (u.managerId ?? null)) patch.managerId = reportsTo || null
    if (role === 'manager' && canCreate !== u.canCreateCourses) patch.canCreateCourses = canCreate
    if (Object.keys(patch).length === 0) return
    setSaveError(null)
    setBusy(true)
    try {
      await apiPatch(`/users/${userId}`, patch)
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <p className="font-semibold">{error ?? 'Member not found'}</p>
        <Link href={backHref} className="mt-3 inline-block text-sm text-accent">
          ← Back to {backLabel}
        </Link>
      </div>
    )
  }

  const { user, enrollments, stats } = data

  const dirty =
    name.trim() !== (user.fullName ?? '') ||
    role !== user.role ||
    (reportsTo || null) !== (user.managerId ?? null) ||
    (role === 'manager' && canCreate !== user.canCreateCourses)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
        >
          <ChevronLeft size={16} /> {backLabel}
        </Link>
        {canEdit &&
          (editing ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-accent/60"
            >
              <X size={15} /> Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-accent/60"
            >
              <Pencil size={15} /> Edit details
            </button>
          ))}
      </div>

      {/* Profile header */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={user} size={64} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{user.fullName ?? 'Pending'}</h1>
            <p className="text-sm text-muted">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full border px-2.5 py-1 font-medium capitalize ${roleBadge[user.role] ?? roleBadge.employee}`}
              >
                {user.role}
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 capitalize text-muted">
                {user.status}
              </span>
              {user.manager && (
                <span className="text-muted">Reports to {user.manager.fullName ?? user.manager.email}</span>
              )}
              <span className="text-muted">· Joined {fmtDate(user.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Courses enrolled" value={stats.courseCount} />
          <Stat label="In progress" value={stats.inProgress} />
          <Stat label="Completed" value={stats.completedCourses} />
          <Stat label="Avg. progress" value={`${stats.avgProgress}%`} />
        </div>
      </div>

      {/* Edit panel (admin only) */}
      {canEdit && editing && (
        <div className="space-y-4 rounded-2xl border border-accent/40 bg-card p-6 shadow-sm">
          <h2 className="font-semibold">Edit details</h2>
          {saveError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">
              {saveError}
            </p>
          )}

          <Field label="Full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-accent"
            />
          </Field>

          <Field label="Email">
            <input
              value={user.email}
              disabled
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-muted"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role">
              <Select
                ariaLabel="Role"
                disabled={busy || user.id === me?.id}
                value={role}
                onChange={(v) => setRole(v as 'admin' | 'manager' | 'employee')}
                options={[
                  { value: 'employee', label: 'Employee' },
                  { value: 'manager', label: 'Manager' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </Field>

            <Field label="Reports to">
              <Select
                ariaLabel="Reports to"
                disabled={busy}
                placeholder="No manager"
                value={reportsTo}
                onChange={setReportsTo}
                options={[
                  { value: '', label: 'No manager' },
                  ...managers
                    .filter((m) => m.id !== user.id)
                    .map((m) => ({ value: m.id, label: m.fullName ?? m.email })),
                ]}
              />
            </Field>
          </div>

          {role === 'manager' && (
            <Field label="Course creation">
              <label className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={canCreate}
                  disabled={busy}
                  onChange={(e) => setCanCreate(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Allow this manager to create and edit courses
              </label>
            </Field>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={saveDetails}
              disabled={busy || !dirty}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save details'}
            </button>
            {dirty && !busy && <span className="text-xs text-muted">You have unsaved changes</span>}
          </div>

          {user.id !== me?.id && (
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-500 transition duration-200 hover:bg-red-500/10"
              >
                Delete user
              </button>
              <p className="mt-2 text-xs text-muted">Permanently removes this account. This cannot be undone.</p>
            </div>
          )}
        </div>
      )}

      {/* Course progress */}
      <section>
        <h2 className="text-xl font-bold">Course progress</h2>
        {enrollments.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">
            {user.fullName ?? 'This member'} hasn&apos;t enrolled in any courses yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {enrollments.map((e) => (
              <ProgressRow key={e.id} e={e} />
            ))}
          </div>
        )}
      </section>

      {showDelete && (
        <ConfirmDeleteModal
          title="Delete this user?"
          confirmText={user.email}
          confirmHint="User's email"
          description={
            <>
              This permanently deletes{' '}
              <span className="font-medium text-foreground">{user.fullName ?? user.email}</span> and revokes their
              access. This cannot be undone.
            </>
          }
          confirmLabel="Delete user"
          onCancel={() => setShowDelete(false)}
          onConfirm={async () => {
            await apiDelete(`/users/${user.id}`)
            router.push(backHref)
          }}
        />
      )}
    </div>
  )
}
