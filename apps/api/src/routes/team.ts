import { prisma } from '@toplms/db'
import { assignCourseSchema, testAllowanceSchema } from '@toplms/validation'
import { Router } from 'express'
import { courseSummarySelect } from '../lib/courses'
import { safeUserSelect } from '../lib/user'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const teamRouter = Router()

// Derive a live status from the recomputed percentage so the badge always
// matches the bar — even if the course gained/lost lessons after completion.
function statusFromPercent(percent: number): 'not_started' | 'in_progress' | 'completed' {
  if (percent >= 100) return 'completed'
  if (percent > 0) return 'in_progress'
  return 'not_started'
}

// Nested select that lets us recompute progress from lessons + passed required tests.
const enrollmentProgressSelect = {
  course: {
    select: {
      modules: {
        select: {
          _count: { select: { lessons: true } },
          test: { select: { id: true, isRequired: true } },
        },
      },
    },
  },
  lessonProgress: { where: { status: 'completed' as const }, select: { lessonId: true } },
  testAttempts: { where: { passed: true }, select: { testId: true } },
}

function computePercent(e: {
  course: { modules: { _count: { lessons: number }; test: { id: string; isRequired: boolean } | null }[] }
  lessonProgress: { lessonId: string }[]
  testAttempts: { testId: string }[]
}): { totalLessons: number; completedLessons: number; percent: number } {
  const totalLessons = e.course.modules.reduce((sum, m) => sum + m._count.lessons, 0)
  const completedLessons = e.lessonProgress.length
  const requiredTestIds = e.course.modules
    .map((m) => m.test)
    .filter((t): t is { id: string; isRequired: boolean } => Boolean(t) && t!.isRequired)
    .map((t) => t.id)
  const passed = new Set(e.testAttempts.map((a) => a.testId))
  const passedRequired = requiredTestIds.filter((tid) => passed.has(tid)).length
  const total = totalLessons + requiredTestIds.length
  const done = completedLessons + passedRequired
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return { totalLessons, completedLessons, percent }
}

// GET /api/team — the people this user oversees, each with a progress summary.
// An admin sees everyone; a manager sees only their direct reports.
teamRouter.get('/', requireAuth, async (req, res) => {
  const me = req.user!
  if (me.role !== 'admin' && me.role !== 'manager') throw new HttpError(403, 'Forbidden')

  // My Team lists only the people who directly report to this user — for an
  // admin as well as a manager. Empty until someone is assigned to them.
  const rows = await prisma.user.findMany({
    where: { managerId: me.id },
    orderBy: { createdAt: 'desc' },
    select: {
      ...safeUserSelect,
      enrollments: { select: enrollmentProgressSelect },
    },
  })

  const members = rows.map((row) => {
    const { enrollments, ...user } = row
    const percents = enrollments.map((e) => computePercent(e).percent)
    const courseCount = percents.length
    const completedCourses = percents.filter((p) => p >= 100).length
    const avgProgress =
      courseCount > 0 ? Math.round(percents.reduce((sum, p) => sum + p, 0) / courseCount) : 0
    return { ...user, courseCount, completedCourses, avgProgress }
  })

  res.json({ members })
})

// GET /api/team/overview — team learning health for the manager/admin dashboard.
// Registered before /:id so "overview" isn't treated as a user id.
teamRouter.get('/overview', requireAuth, async (req, res) => {
  const me = req.user!
  if (me.role !== 'admin' && me.role !== 'manager') throw new HttpError(403, 'Forbidden')

  const now = Date.now()
  const DAY = 86_400_000
  const rows = await prisma.user.findMany({
    where: { managerId: me.id },
    orderBy: { createdAt: 'desc' },
    select: {
      ...safeUserSelect,
      lastLoginAt: true,
      enrollments: {
        select: {
          ...enrollmentProgressSelect,
          isMandatory: true,
          dueDate: true,
          lessonProgress: { where: { status: 'completed' as const }, select: { lessonId: true, completedAt: true, lastAccessedAt: true } },
          testAttempts: { where: { passed: true }, select: { testId: true, submittedAt: true } },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              modules: {
                select: {
                  _count: { select: { lessons: true } },
                  test: { select: { id: true, isRequired: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  let aggCompleted = 0
  let aggInProgress = 0
  let aggNotStarted = 0
  let aggOverdue = 0
  const overdueList: {
    userId: string
    userName: string
    avatar: { storageKey: string; provider: string } | null
    courseId: string
    courseTitle: string
    courseSlug: string
    dueDate: Date
    daysOverdue: number
    progressPercent: number
  }[] = []

  const members = rows.map((row) => {
    const { enrollments, lastLoginAt, ...user } = row
    let overdue = 0
    let inProgress = 0
    let notStarted = 0
    let lastActivity = lastLoginAt?.getTime() ?? 0

    const percents = enrollments.map((e) => {
      const percent = computePercent(e).percent
      if (percent >= 100) aggCompleted++
      else if (percent > 0) {
        aggInProgress++
        inProgress++
      } else {
        aggNotStarted++
        notStarted++
      }

      for (const lp of e.lessonProgress) {
        const t = (lp.lastAccessedAt ?? lp.completedAt)?.getTime() ?? 0
        if (t > lastActivity) lastActivity = t
      }
      for (const a of e.testAttempts) {
        const t = a.submittedAt?.getTime() ?? 0
        if (t > lastActivity) lastActivity = t
      }

      if (e.isMandatory && percent < 100 && e.dueDate && e.dueDate.getTime() < now) {
        overdue++
        overdueList.push({
          userId: user.id,
          userName: user.fullName ?? user.email,
          avatar: user.avatar,
          courseId: e.course.id,
          courseTitle: e.course.title,
          courseSlug: e.course.slug,
          dueDate: e.dueDate,
          daysOverdue: Math.floor((now - e.dueDate.getTime()) / DAY),
          progressPercent: percent,
        })
      }
      return percent
    })
    aggOverdue += overdue
    const courseCount = percents.length
    const completedCourses = percents.filter((p) => p >= 100).length
    const avgProgress =
      courseCount > 0 ? Math.round(percents.reduce((s, p) => s + p, 0) / courseCount) : 0
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      courseCount,
      completedCourses,
      inProgress,
      notStarted,
      avgProgress,
      overdueMandatory: overdue,
      lastActivityAt: lastActivity > 0 ? new Date(lastActivity).toISOString() : null,
    }
  })

  overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue)

  const teamSize = members.length
  const avgProgress =
    teamSize > 0 ? Math.round(members.reduce((s, m) => s + m.avgProgress, 0) / teamSize) : 0
  const totalCompleted = members.reduce((s, m) => s + m.completedCourses, 0)

  res.json({
    teamSize,
    aggregate: {
      avgProgress,
      totalCompleted,
      overdueMandatory: aggOverdue,
      enrollments: {
        completed: aggCompleted,
        inProgress: aggInProgress,
        notStarted: aggNotStarted,
        total: aggCompleted + aggInProgress + aggNotStarted,
      },
    },
    overdue: overdueList,
    members,
  })
})

// GET /api/team/:id — one member's profile and per-course progress.
// An admin can view anyone; a manager only their own reports.
teamRouter.get('/:id', requireAuth, async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)

  const user = await prisma.user.findUnique({ where: { id }, select: safeUserSelect })
  if (!user) throw new HttpError(404, 'User not found')

  const allowed = me.role === 'admin' || (me.role === 'manager' && user.managerId === me.id)
  if (!allowed) throw new HttpError(403, 'You can only view your own team members')

  const rows = await prisma.enrollment.findMany({
    where: { userId: id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      completedAt: true,
      updatedAt: true,
      isMandatory: true,
      dueDate: true,
      course: {
        select: {
          ...courseSummarySelect,
          modules: {
            select: {
              _count: { select: { lessons: true } },
              test: { select: { id: true, isRequired: true } },
            },
          },
        },
      },
      lessonProgress: { where: { status: 'completed' }, select: { lessonId: true } },
      testAttempts: {
        orderBy: { attemptNumber: 'asc' },
        select: {
          id: true,
          attemptNumber: true,
          score: true,
          passed: true,
          submittedAt: true,
          screenRecordingId: true,
          cameraRecordingId: true,
          test: {
            select: {
              id: true,
              title: true,
              isRequired: true,
              maxAttempts: true,
              module: { select: { title: true } },
            },
          },
        },
      },
    },
  })

  // Per-learner attempt overrides, applied on top of each test's own limit.
  const allowanceRows = await prisma.testAllowance.findMany({
    where: { userId: id },
    select: { testId: true, maxAttempts: true },
  })
  const allowanceBy = new Map(allowanceRows.map((a) => [a.testId, a.maxAttempts]))

  const enrollments = rows.map((e) => {
    const { modules, ...course } = e.course
    const { totalLessons, completedLessons, percent } = computePercent({
      course: { modules },
      lessonProgress: e.lessonProgress,
      testAttempts: e.testAttempts.filter((a) => a.passed).map((a) => ({ testId: a.test.id })),
    })

    // Group attempts per section test for the manager report.
    const byTest = new Map<
      string,
      {
        testId: string
        testTitle: string
        sectionTitle: string
        isRequired: boolean
        attempts: number
        attemptLimit: number | null
        bestScore: number
        passed: boolean
        lastAttemptAt: Date | null
        history: {
          id: string
          attemptNumber: number
          score: number | null
          passed: boolean | null
          submittedAt: Date | null
          hasScreen: boolean
          hasCamera: boolean
        }[]
      }
    >()
    for (const a of e.testAttempts) {
      const t = a.test
      let g = byTest.get(t.id)
      if (!g) {
        g = {
          testId: t.id,
          testTitle: t.title,
          sectionTitle: t.module.title,
          isRequired: t.isRequired,
          attempts: 0,
          attemptLimit: allowanceBy.get(t.id) ?? t.maxAttempts ?? null,
          bestScore: 0,
          passed: false,
          lastAttemptAt: null,
          history: [],
        }
        byTest.set(t.id, g)
      }
      g.attempts += 1
      g.bestScore = Math.max(g.bestScore, a.score ?? 0)
      g.passed = g.passed || Boolean(a.passed)
      g.lastAttemptAt = a.submittedAt ?? g.lastAttemptAt
      g.history.push({
        id: a.id,
        attemptNumber: a.attemptNumber,
        score: a.score,
        passed: a.passed,
        submittedAt: a.submittedAt,
        hasScreen: Boolean(a.screenRecordingId),
        hasCamera: Boolean(a.cameraRecordingId),
      })
    }

    return {
      id: e.id,
      status: statusFromPercent(percent),
      progressPercent: percent,
      totalLessons,
      completedLessons,
      completedAt: e.completedAt,
      updatedAt: e.updatedAt,
      isMandatory: e.isMandatory,
      dueDate: e.dueDate,
      testResults: [...byTest.values()],
      course,
    }
  })

  const courseCount = enrollments.length
  const completedCourses = enrollments.filter((e) => e.status === 'completed').length
  // "In progress" = enrolled but not yet completed, including not-started courses —
  // matches the learner's own dashboard so the numbers agree across views.
  const inProgress = enrollments.filter((e) => e.progressPercent < 100).length
  const avgProgress =
    courseCount > 0
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progressPercent, 0) / courseCount)
      : 0

  res.json({ user, enrollments, stats: { courseCount, completedCourses, inProgress, avgProgress } })
})

// POST /api/team/:id/assign — assign a course to a report as mandatory (admin, or their manager).
teamRouter.post('/:id/assign', requireAuth, validateBody(assignCourseSchema), async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)
  const { courseId, dueDate } = req.body as { courseId: string; dueDate?: Date | null }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, managerId: true } })
  if (!target) throw new HttpError(404, 'User not found')
  const allowed = me.role === 'admin' || (me.role === 'manager' && target.managerId === me.id)
  if (!allowed) throw new HttpError(403, 'You can only assign courses to your own team members')

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, status: true } })
  if (!course) throw new HttpError(404, 'Course not found')
  if (course.status !== 'published') throw new HttpError(400, 'Only published courses can be assigned')

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: id, courseId } },
    update: { isMandatory: true, dueDate: dueDate ?? null, enrolledById: me.id },
    create: { userId: id, courseId, isMandatory: true, dueDate: dueDate ?? null, enrolledById: me.id },
    select: { id: true, isMandatory: true, dueDate: true },
  })
  res.status(201).json({ enrollment })
})

// POST /api/team/:id/test-allowance — raise or lower one learner's attempt limit for a test.
teamRouter.post('/:id/test-allowance', requireAuth, validateBody(testAllowanceSchema), async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)
  const { testId, maxAttempts } = req.body as { testId: string; maxAttempts: number }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, managerId: true } })
  if (!target) throw new HttpError(404, 'User not found')
  const allowed = me.role === 'admin' || (me.role === 'manager' && target.managerId === me.id)
  if (!allowed) throw new HttpError(403, 'You can only manage your own team members')

  const test = await prisma.test.findUnique({ where: { id: testId }, select: { id: true } })
  if (!test) throw new HttpError(404, 'Test not found')

  const allowance = await prisma.testAllowance.upsert({
    where: { testId_userId: { testId, userId: id } },
    update: { maxAttempts, grantedById: me.id },
    create: { testId, userId: id, maxAttempts, grantedById: me.id },
    select: { testId: true, maxAttempts: true },
  })
  res.json({ allowance })
})

// DELETE /api/team/:id/assignments/:courseId — remove the mandatory flag (keeps their progress).
teamRouter.delete('/:id/assignments/:courseId', requireAuth, async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)
  const courseId = String(req.params.courseId)

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, managerId: true } })
  if (!target) throw new HttpError(404, 'User not found')
  const allowed = me.role === 'admin' || (me.role === 'manager' && target.managerId === me.id)
  if (!allowed) throw new HttpError(403, 'You can only manage your own team members')

  await prisma.enrollment.updateMany({
    where: { userId: id, courseId },
    data: { isMandatory: false, dueDate: null },
  })
  res.status(204).end()
})
