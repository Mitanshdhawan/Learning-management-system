import { prisma } from '@toplms/db'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'

export const adminRouter = Router()

const DAY = 86_400_000

interface EnrollmentRow {
  createdAt: Date
  completedAt: Date | null
  isMandatory: boolean
  dueDate: Date | null
  user: {
    id: string
    fullName: string | null
    email: string
    lastLoginAt: Date | null
    avatar: { storageKey: string; provider: string } | null
    manager: { fullName: string | null; email: string } | null
  }
  course: {
    id: string
    title: string
    slug: string
    status: string
    modules: { _count: { lessons: number }; test: { id: string; isRequired: boolean } | null }[]
  }
  lessonProgress: { completedAt: Date | null; lastAccessedAt: Date | null }[]
  testAttempts: { testId: string; submittedAt: Date | null }[]
}

function percentOf(e: EnrollmentRow): number {
  const totalLessons = e.course.modules.reduce((s, m) => s + m._count.lessons, 0)
  const requiredTestIds = e.course.modules
    .map((m) => m.test)
    .filter((t): t is { id: string; isRequired: boolean } => Boolean(t) && t!.isRequired)
    .map((t) => t.id)
  const passed = new Set(e.testAttempts.map((a) => a.testId))
  const passedRequired = requiredTestIds.filter((id) => passed.has(id)).length
  const totalUnits = totalLessons + requiredTestIds.length
  const doneUnits = e.lessonProgress.length + passedRequired
  return totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0
}

// Most recent genuine learner activity on this enrollment (excludes admin edits).
function enrollmentActivity(e: EnrollmentRow): number | null {
  let max = 0
  for (const lp of e.lessonProgress) {
    const t = (lp.lastAccessedAt ?? lp.completedAt)?.getTime() ?? 0
    if (t > max) max = t
  }
  for (const a of e.testAttempts) {
    const t = a.submittedAt?.getTime() ?? 0
    if (t > max) max = t
  }
  return max > 0 ? max : null
}

// GET /api/admin/overview — headline counts + org-wide learning health.
adminRouter.get('/overview', requireAuth, requireRole('admin'), async (_req, res) => {
  const now = Date.now()
  const [totalUsers, admins, managers, employees, pendingInvites, courses, publishedCourses] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'admin' } }),
      prisma.user.count({ where: { role: 'manager' } }),
      prisma.user.count({ where: { role: 'employee' } }),
      prisma.invitation.count({ where: { acceptedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.course.count(),
      prisma.course.count({ where: { status: 'published' } }),
    ])

  const enrollments = (await prisma.enrollment.findMany({
    select: {
      createdAt: true,
      completedAt: true,
      isMandatory: true,
      dueDate: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          lastLoginAt: true,
          avatar: { select: { storageKey: true, provider: true } },
          manager: { select: { fullName: true, email: true } },
        },
      },
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          modules: {
            select: {
              _count: { select: { lessons: true } },
              test: { select: { id: true, isRequired: true } },
            },
          },
        },
      },
      lessonProgress: {
        where: { status: 'completed' },
        select: { completedAt: true, lastAccessedAt: true },
      },
      testAttempts: { where: { passed: true }, select: { testId: true, submittedAt: true } },
    },
  })) as EnrollmentRow[]

  let completed = 0
  let inProgress = 0
  let notStarted = 0
  const overdueItems: {
    userId: string
    userName: string
    userEmail: string
    avatar: { storageKey: string; provider: string } | null
    courseId: string
    courseTitle: string
    courseSlug: string
    dueDate: Date
    daysOverdue: number
    progressPercent: number
    managerName: string | null
  }[] = []
  const stalledItems: {
    userId: string
    userName: string
    avatar: { storageKey: string; provider: string } | null
    courseId: string
    courseTitle: string
    courseSlug: string
    progressPercent: number
    lastActivityAt: Date | null
    daysInactive: number
  }[] = []

  // Per-user last activity (max across enrollments + lastLoginAt) → active/dormant.
  const learners = new Map<string, { last: number | null; name: string }>()
  const byCourse = new Map<
    string,
    { id: string; title: string; slug: string; total: number; completed: number; inProgress: number; notStarted: number }
  >()

  // 8 rolling weekly buckets ending now.
  const WEEK = 7 * DAY
  const windowStart = now - 8 * WEEK
  const trend = Array.from({ length: 8 }, (_, i) => {
    const start = windowStart + i * WEEK
    return {
      weekStart: new Date(start).toISOString().slice(0, 10),
      weekLabel: new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      enrolled: 0,
      completed: 0,
    }
  })
  const bucketOf = (d: Date | null): number => {
    if (!d) return -1
    const idx = Math.floor((d.getTime() - windowStart) / WEEK)
    return idx >= 0 && idx < 8 ? idx : -1
  }

  for (const e of enrollments) {
    const percent = percentOf(e)
    if (percent >= 100) completed++
    else if (percent > 0) inProgress++
    else notStarted++

    // Per-user activity roll-up
    const act = enrollmentActivity(e)
    const login = e.user.lastLoginAt?.getTime() ?? null
    const combined = Math.max(act ?? 0, login ?? 0) || null
    const name = e.user.fullName ?? e.user.email
    const prev = learners.get(e.user.id)
    if (prev === undefined) learners.set(e.user.id, { last: combined, name })
    else if (combined && (!prev.last || combined > prev.last)) learners.set(e.user.id, { last: combined, name })

    // Overdue mandatory (WHO)
    if (e.isMandatory && percent < 100 && e.dueDate && e.dueDate.getTime() < now) {
      overdueItems.push({
        userId: e.user.id,
        userName: e.user.fullName ?? e.user.email,
        userEmail: e.user.email,
        avatar: e.user.avatar,
        courseId: e.course.id,
        courseTitle: e.course.title,
        courseSlug: e.course.slug,
        dueDate: e.dueDate,
        daysOverdue: Math.floor((now - e.dueDate.getTime()) / DAY),
        progressPercent: percent,
        managerName: e.user.manager?.fullName ?? e.user.manager?.email ?? null,
      })
    }

    // Stalled: started, not done, quiet 14+ days
    if (percent > 0 && percent < 100) {
      const lastAt = act
      const daysInactive = Math.floor((now - (lastAt ?? e.createdAt.getTime())) / DAY)
      if (daysInactive > 14) {
        stalledItems.push({
          userId: e.user.id,
          userName: e.user.fullName ?? e.user.email,
          avatar: e.user.avatar,
          courseId: e.course.id,
          courseTitle: e.course.title,
          courseSlug: e.course.slug,
          progressPercent: percent,
          lastActivityAt: lastAt ? new Date(lastAt) : null,
          daysInactive,
        })
      }
    }

    // Trend buckets
    const cb = bucketOf(e.createdAt)
    if (cb >= 0) trend[cb].enrolled++
    if (percent >= 100) {
      const db = bucketOf(e.completedAt)
      if (db >= 0) trend[db].completed++
    }

    // Course performance (published only)
    if (e.course.status === 'published') {
      let c = byCourse.get(e.course.id)
      if (!c)
        byCourse.set(
          e.course.id,
          (c = { id: e.course.id, title: e.course.title, slug: e.course.slug, total: 0, completed: 0, inProgress: 0, notStarted: 0 }),
        )
      c.total++
      if (percent >= 100) c.completed++
      else if (percent > 0) c.inProgress++
      else c.notStarted++
    }
  }

  overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue)
  stalledItems.sort((a, b) => b.daysInactive - a.daysInactive)

  const totalLearners = learners.size
  let activeLast30 = 0
  const active7: { id: string; name: string; last: number }[] = []
  for (const [id, v] of learners) {
    if (!v.last) continue
    if (now - v.last <= 7 * DAY) active7.push({ id, name: v.name, last: v.last })
    if (now - v.last <= 30 * DAY) activeLast30++
  }
  active7.sort((a, b) => b.last - a.last)
  const activeLast7 = active7.length

  const total = enrollments.length
  const topCourses = [...byCourse.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      enrollments: c.total,
      completed: c.completed,
      inProgress: c.inProgress,
      notStarted: c.notStarted,
      completionRate: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
    }))

  res.json({
    totalUsers,
    admins,
    managers,
    employees,
    pendingInvites,
    courses,
    publishedCourses,
    enrollments: { total, completed, inProgress, notStarted },
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    activity: {
      totalLearners,
      activeLast7,
      activeLast30,
      dormant: totalLearners - activeLast30,
      active7: active7.slice(0, 15).map((a) => ({ id: a.id, name: a.name })),
    },
    overdue: { overdueCount: overdueItems.length, items: overdueItems.slice(0, 50) },
    stalled: { count: stalledItems.length, items: stalledItems.slice(0, 8) },
    completionsTrend: trend,
    topCourses,
  })
})
