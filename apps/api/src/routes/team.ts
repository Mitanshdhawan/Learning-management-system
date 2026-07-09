import { prisma } from '@toplms/db'
import { Router } from 'express'
import { courseSummarySelect } from '../lib/courses'
import { safeUserSelect } from '../lib/user'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'

export const teamRouter = Router()

// Derive a live status from the recomputed percentage so the badge always
// matches the bar — even if the course gained/lost lessons after completion.
function statusFromPercent(percent: number): 'not_started' | 'in_progress' | 'completed' {
  if (percent >= 100) return 'completed'
  if (percent > 0) return 'in_progress'
  return 'not_started'
}

// Nested select that lets us recompute progress from actual lesson completion.
const enrollmentProgressSelect = {
  course: { select: { modules: { select: { _count: { select: { lessons: true } } } } } },
  lessonProgress: { where: { status: 'completed' as const }, select: { lessonId: true } },
}

function computePercent(e: {
  course: { modules: { _count: { lessons: number } }[] }
  lessonProgress: { lessonId: string }[]
}): { totalLessons: number; completedLessons: number; percent: number } {
  const totalLessons = e.course.modules.reduce((sum, m) => sum + m._count.lessons, 0)
  const completedLessons = e.lessonProgress.length
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
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
      course: {
        select: {
          ...courseSummarySelect,
          modules: { select: { _count: { select: { lessons: true } } } },
        },
      },
      lessonProgress: { where: { status: 'completed' }, select: { lessonId: true } },
    },
  })

  const enrollments = rows.map((e) => {
    const { modules, ...course } = e.course
    const { totalLessons, completedLessons, percent } = computePercent({
      course: { modules },
      lessonProgress: e.lessonProgress,
    })
    return {
      id: e.id,
      status: statusFromPercent(percent),
      progressPercent: percent,
      totalLessons,
      completedLessons,
      completedAt: e.completedAt,
      updatedAt: e.updatedAt,
      course,
    }
  })

  const courseCount = enrollments.length
  const completedCourses = enrollments.filter((e) => e.status === 'completed').length
  const inProgress = enrollments.filter((e) => e.status === 'in_progress').length
  const avgProgress =
    courseCount > 0
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progressPercent, 0) / courseCount)
      : 0

  res.json({ user, enrollments, stats: { courseCount, completedCourses, inProgress, avgProgress } })
})
