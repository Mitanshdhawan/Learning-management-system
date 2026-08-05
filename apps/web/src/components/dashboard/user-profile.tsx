'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Ban,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ListChecks,
  Minus,
  Monitor,
  Pencil,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, type AuthUser } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { AvatarCropModal } from '@/components/avatar-crop-modal'
import { AttemptDetailModal } from '@/components/courses/attempt-detail-modal'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import { Select } from '@/components/ui/select'
import { apiDelete, apiGet, apiPatch, apiPost, uploadAvatarFor } from '@/lib/api'
import { type CourseSummary, courseThumbUrl } from '@/lib/courses'

interface MemberUser {
  id: string
  email: string
  fullName: string | null
  role: 'admin' | 'manager' | 'employee'
  status: string
  canCreateCourses: boolean
  canManageAllCourses: boolean
  managerId: string | null
  createdAt: string
  avatar: { storageKey: string; provider: string } | null
  manager: { id: string; fullName: string | null; email: string } | null
}

interface AttemptRow {
  id: string
  attemptNumber: number
  score: number | null
  passed: boolean | null
  submittedAt: string | null
  hasScreen: boolean
  hasCamera: boolean
}

interface TestResult {
  testId: string
  testTitle: string
  sectionTitle: string
  isRequired: boolean
  attempts: number
  attemptLimit: number | null
  bestScore: number
  passed: boolean
  lastAttemptAt: string | null
  history: AttemptRow[]
}

interface MemberEnrollment {
  id: string
  status: string
  progressPercent: number
  totalLessons: number
  completedLessons: number
  completedAt: string | null
  updatedAt: string
  isMandatory: boolean
  dueDate: string | null
  testResults: TestResult[]
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

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

type CoursePerm = 'none' | 'own' | 'all'

/** The manager's course permission level, derived from the two flags. */
function permOf(u: { canCreateCourses: boolean; canManageAllCourses: boolean }): CoursePerm {
  return u.canManageAllCourses ? 'all' : u.canCreateCourses ? 'own' : 'none'
}

const COURSE_PERM_OPTIONS: { value: CoursePerm; label: string; hint: string }[] = [
  { value: 'none', label: 'No course access', hint: 'Cannot create or edit courses.' },
  { value: 'own', label: 'Create & edit own courses', hint: 'Can create courses and edit the ones they created.' },
  { value: 'all', label: 'Edit all courses', hint: 'Can create courses and edit any course.' },
]

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

/** One section test inside the report: summary row that expands into its attempt log. */
function TestResultRow({
  t,
  onOpenAttempt,
  onSetAllowance,
}: {
  t: TestResult
  onOpenAttempt: (attemptId: string) => void
  onSetAllowance?: (testId: string, maxAttempts: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [savingLimit, setSavingLimit] = useState(false)

  async function nudge(delta: number) {
    if (!onSetAllowance || savingLimit) return
    // With no limit set there is nothing to decrease; start from the attempts used.
    const base = t.attemptLimit ?? t.attempts
    const next = Math.min(50, Math.max(1, base + delta))
    if (next === t.attemptLimit) return
    setSavingLimit(true)
    try {
      await onSetAllowance(t.testId, next)
    } finally {
      setSavingLimit(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-background/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs transition hover:bg-card"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-muted">
          <ChevronRight
            size={13}
            className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <ListChecks size={13} className="shrink-0 text-accent" />
          <span className="truncate text-foreground">{t.testTitle}</span>
          <span className="shrink-0 text-muted/60">
            · {t.attempts}
            {t.attemptLimit != null ? `/${t.attemptLimit}` : ''} attempt
            {t.attempts === 1 && t.attemptLimit == null ? '' : 's'}
          </span>
        </span>
        <span className={`shrink-0 font-medium ${t.passed ? 'text-emerald-500' : 'text-red-500'}`}>
          {t.bestScore}% {t.passed ? '· passed' : '· not passed'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 border-t border-border/60 px-2.5 py-2">
              {onSetAllowance && (
                <div className="flex items-center justify-between gap-2 pb-1 text-xs">
                  <span className="text-muted">
                    Attempts allowed:{' '}
                    <span className="font-medium text-foreground">
                      {t.attemptLimit ?? 'unlimited'}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={savingLimit || (t.attemptLimit ?? 0) <= 1}
                      onClick={() => nudge(-1)}
                      aria-label="Decrease attempts"
                      className="rounded-md border border-border px-1.5 py-0.5 transition hover:bg-card disabled:opacity-40"
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={savingLimit}
                      onClick={() => nudge(1)}
                      aria-label="Increase attempts"
                      className="rounded-md border border-border px-1.5 py-0.5 transition hover:bg-card disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                  </span>
                </div>
              )}

              {t.history.length === 0 ? (
                <p className="text-xs text-muted">No attempts yet.</p>
              ) : (
                t.history.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onOpenAttempt(a.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-left text-xs transition hover:border-accent/50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-medium">Attempt {a.attemptNumber}</span>
                      <span className="truncate text-muted">{fmtDate(a.submittedAt)}</span>
                      {(a.hasScreen || a.hasCamera) && (
                        <Monitor size={12} className="shrink-0 text-muted/70" />
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={a.passed ? 'text-emerald-500' : 'text-red-500'}>
                        {a.score ?? 0}%
                      </span>
                      <span className="text-accent">View</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ProgressRow({
  e,
  onUnassign,
  onOpenAttempt,
  onSetAllowance,
}: {
  e: MemberEnrollment
  onUnassign?: (courseId: string) => void
  onOpenAttempt: (attemptId: string) => void
  onSetAllowance?: (testId: string, maxAttempts: number) => Promise<void>
}) {
  const thumb = courseThumbUrl(e.course.thumbnail)
  const done = e.status === 'completed'
  const overdue = e.dueDate ? !done && new Date(e.dueDate).getTime() < Date.now() : false
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
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
            {(e.isMandatory || e.dueDate) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {e.isMandatory && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                    Mandatory
                  </span>
                )}
                {e.dueDate && (
                  <span className={overdue ? 'font-medium text-red-500' : 'text-muted'}>
                    Due {fmtDate(e.dueDate)}
                    {overdue ? ' · overdue' : ''}
                  </span>
                )}
                {e.isMandatory && onUnassign && (
                  <button
                    type="button"
                    onClick={() => onUnassign(e.course.id)}
                    className="text-muted/70 underline-offset-2 transition hover:text-red-500 hover:underline"
                  >
                    remove
                  </button>
                )}
              </div>
            )}
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
        {e.testResults.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-border pt-2.5">
            {e.testResults.map((t) => (
              <TestResultRow
                key={t.testId}
                t={t}
                onOpenAttempt={onOpenAttempt}
                onSetAllowance={onSetAllowance}
              />
            ))}
          </div>
        )}
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
  const [coursePerm, setCoursePerm] = useState<CoursePerm>('none')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)

  // Assign-a-course state
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null)
  const [assignCourses, setAssignCourses] = useState<{ id: string; title: string }[]>([])
  const [assignId, setAssignId] = useState('')
  const [assignDue, setAssignDue] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const isAdmin = me?.role === 'admin'

  const load = useCallback(async () => {
    try {
      const d = await apiGet<Report>(`/team/${userId}`)
      setData(d)
      setName(d.user.fullName ?? '')
      setRole(d.user.role)
      setReportsTo(d.user.managerId ?? '')
      setCoursePerm(permOf(d.user))
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
    if (!editing || !isAdmin) return
    apiGet<{ users: AuthUser[] }>('/users')
      .then((d) => setManagers(d.users.filter((u) => u.role === 'manager' || u.role === 'admin')))
      .catch(() => {})
  }, [editing, isAdmin])

  // Load published courses for the assign picker (admins + a report's own manager).
  useEffect(() => {
    if (!data) return
    const canManage = me?.role === 'admin' || (me?.role === 'manager' && data.user.managerId === me?.id)
    if (!canManage) return
    apiGet<{ courses: CourseSummary[] }>('/courses')
      .then((d) =>
        setAssignCourses(
          d.courses.filter((c) => c.status === 'published').map((c) => ({ id: c.id, title: c.title })),
        ),
      )
      .catch(() => {})
  }, [data, me])

  async function assignCourse() {
    if (!assignId) return
    setAssignBusy(true)
    setAssignError(null)
    try {
      await apiPost(`/team/${userId}/assign`, { courseId: assignId, dueDate: assignDue || null })
      setAssignId('')
      setAssignDue('')
      await load()
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign the course')
    } finally {
      setAssignBusy(false)
    }
  }

  async function unassignCourse(courseId: string) {
    try {
      await apiDelete(`/team/${userId}/assignments/${courseId}`)
      await load()
    } catch {
      /* ignore */
    }
  }

  // Raise or lower how many times this one learner may sit a given test.
  async function setAllowance(testId: string, maxAttempts: number) {
    try {
      await apiPost(`/team/${userId}/test-allowance`, { testId, maxAttempts })
      await load()
    } catch {
      /* ignore */
    }
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setCropFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onCropped(blob: Blob) {
    setCropFile(null)
    setSaveError(null)
    setBusy(true)
    try {
      await uploadAvatarFor(userId, blob)
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update the photo')
    } finally {
      setBusy(false)
    }
  }

  // Block (deactivate) or restore a user's sign-in access.
  async function setBlocked(blocked: boolean) {
    setSaveError(null)
    setBusy(true)
    try {
      await apiPatch(`/users/${userId}/status`, { status: blocked ? 'deactivated' : 'active' })
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update access')
    } finally {
      setBusy(false)
    }
  }

  async function saveDetails() {
    if (!data) return
    const u = data.user
    const patch: Record<string, unknown> = {}
    if (name.trim() !== (u.fullName ?? '')) patch.fullName = name.trim()
    if (role !== u.role) patch.role = role
    if ((reportsTo || null) !== (u.managerId ?? null)) patch.managerId = reportsTo || null
    if (role === 'manager' && coursePerm !== permOf(u)) {
      patch.canCreateCourses = coursePerm !== 'none'
      patch.canManageAllCourses = coursePerm === 'all'
    }
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

  // Admins can edit anyone; a manager can edit the basic details of their own reports.
  const canEditProfile = isAdmin || (me?.role === 'manager' && user.managerId === me.id)

  const dirty =
    name.trim() !== (user.fullName ?? '') ||
    role !== user.role ||
    (reportsTo || null) !== (user.managerId ?? null) ||
    (role === 'manager' && coursePerm !== permOf(user))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
        >
          <ChevronLeft size={16} /> {backLabel}
        </Link>
        {canEditProfile &&
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
              <span
                className={`rounded-full border px-2.5 py-1 capitalize ${
                  user.status === 'deactivated'
                    ? 'border-red-500/40 bg-red-500/10 font-medium text-red-500'
                    : 'border-border text-muted'
                }`}
              >
                {user.status === 'deactivated' ? 'Blocked' : user.status}
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

      {/* Edit panel — admins edit everything; managers edit name & photo of their reports */}
      {canEditProfile && editing && (
        <div className="space-y-4 rounded-2xl border border-accent/40 bg-card p-6 shadow-sm">
          <h2 className="font-semibold">Edit details</h2>
          {saveError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">
              {saveError}
            </p>
          )}

          <Field label="Profile photo">
            <div className="flex items-center gap-4">
              <Avatar user={user} size={56} />
              <div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileRef}
                  onChange={onFilePick}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition duration-200 hover:border-accent/60 hover:bg-background disabled:opacity-60"
                >
                  {busy ? 'Working…' : 'Change photo'}
                </button>
                <p className="mt-1 text-xs text-muted">JPG or PNG, up to 5 MB.</p>
              </div>
            </div>
          </Field>

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
                  // Admin isn't a selectable option — only shown so an existing admin displays correctly.
                  ...(user.role === 'admin' ? [{ value: 'admin', label: 'Admin' }] : []),
                ]}
              />
            </Field>

            <Field label="Reports to">
              <Select
                ariaLabel="Reports to"
                // Only admins can reassign; managers see it read-only.
                disabled={busy || !isAdmin}
                placeholder="No manager"
                value={reportsTo}
                onChange={setReportsTo}
                options={[
                  { value: '', label: 'No manager' },
                  // Always include the current manager so the read-only value displays.
                  ...(user.manager
                    ? [{ value: user.manager.id, label: user.manager.fullName ?? user.manager.email }]
                    : []),
                  ...managers
                    .filter((m) => m.id !== user.id && m.id !== user.manager?.id)
                    .map((m) => ({ value: m.id, label: m.fullName ?? m.email })),
                ]}
              />
            </Field>
          </div>

          {isAdmin && role === 'manager' && (
            <Field label="Course permissions">
              <div className="space-y-2">
                {COURSE_PERM_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition hover:border-accent/40"
                  >
                    <input
                      type="radio"
                      name="course-perm"
                      value={o.value}
                      checked={coursePerm === o.value}
                      disabled={busy}
                      onChange={() => setCoursePerm(o.value)}
                      className="mt-0.5 h-4 w-4 accent-accent"
                    />
                    <span>
                      <span className="block font-medium">{o.label}</span>
                      <span className="block text-xs text-muted">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
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
            <div className="space-y-4 border-t border-border pt-4">
              {/* Block / unblock sign-in access (only for users who have joined) */}
              {user.status !== 'invited' && (
                <div>
                  {user.status === 'deactivated' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setBlocked(false)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 px-4 py-2 text-sm font-medium text-emerald-600 transition duration-200 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
                      >
                        <ShieldCheck size={15} /> Restore access
                      </button>
                      <p className="mt-2 text-xs text-muted">
                        This user is blocked and cannot sign in. Restore to let them back in.
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setBlocked(true)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-medium text-amber-600 transition duration-200 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-400"
                      >
                        <Ban size={15} /> Block access
                      </button>
                      <p className="mt-2 text-xs text-muted">
                        They stay in the system but can&apos;t sign in until access is restored.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-500 transition duration-200 hover:bg-red-500/10"
                >
                  Delete user
                </button>
                <p className="mt-2 text-xs text-muted">
                  Permanently removes this account. This cannot be undone.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assign a course (admins + a report's own manager) */}
      {canEditProfile && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-accent" />
            <h2 className="font-bold">Assign a course</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            Make a published course mandatory for {user.fullName ?? 'this member'}, with an optional due date.
          </p>
          {assignError && <p className="mt-2 text-sm text-red-500">{assignError}</p>}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Course</label>
              <Select
                ariaLabel="Course to assign"
                placeholder="Choose a course…"
                value={assignId}
                onChange={setAssignId}
                options={assignCourses.map((c) => ({ value: c.id, label: c.title }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Due date (optional)</label>
              <input
                type="date"
                value={assignDue}
                onChange={(ev) => setAssignDue(ev.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={assignCourse}
              disabled={!assignId || assignBusy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={15} /> {assignBusy ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </section>
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
              <ProgressRow
                key={e.id}
                e={e}
                onUnassign={canEditProfile ? unassignCourse : undefined}
                onOpenAttempt={setOpenAttemptId}
                onSetAllowance={canEditProfile ? setAllowance : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {cropFile && (
        <AvatarCropModal file={cropFile} onCancel={() => setCropFile(null)} onCropped={onCropped} />
      )}

      {openAttemptId && (
        <AttemptDetailModal attemptId={openAttemptId} onClose={() => setOpenAttemptId(null)} />
      )}

      {showDelete && (
        <ConfirmDeleteModal
          title="Delete this user?"
          confirmText={user.email}
          confirmHint="User's email"
          description={
            <>
              This permanently deletes{' '}
              <span className="font-medium text-foreground">{user.fullName ?? user.email}</span>, along with
              their enrollments, test attempts and progress. This cannot be undone. To keep their records,
              use <span className="font-medium text-foreground">Block access</span> instead.
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
