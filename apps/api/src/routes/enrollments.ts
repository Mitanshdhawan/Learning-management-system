import { prisma } from '@toplms/db'
import { Router } from 'express'
import { courseSummarySelect } from '../lib/courses'
import { requireAuth } from '../middleware/auth'

export const enrollmentsRouter = Router()

// GET /api/enrollments — the current user's enrolled courses with progress.
enrollmentsRouter.get('/', requireAuth, async (req, res) => {
  const rows = await prisma.enrollment.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
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
      // Passed attempts, used to require every required test before a course counts done.
      testAttempts: { where: { passed: true }, select: { testId: true } },
    },
  })

  const enrollments = rows.map((e) => {
    const { modules, ...course } = e.course
    const totalLessons = modules.reduce((sum, m) => sum + m._count.lessons, 0)
    const completedLessons = e.lessonProgress.length

    // A course is only complete once its lessons AND every required test are done.
    const requiredTestIds = modules
      .map((m) => m.test)
      .filter((t): t is { id: string; isRequired: boolean } => Boolean(t) && t!.isRequired)
      .map((t) => t.id)
    const passedTestIds = new Set(e.testAttempts.map((a) => a.testId))
    const passedRequired = requiredTestIds.filter((id) => passedTestIds.has(id)).length

    const totalUnits = totalLessons + requiredTestIds.length
    const doneUnits = completedLessons + passedRequired
    return {
      id: e.id,
      status: e.status,
      isMandatory: e.isMandatory,
      dueDate: e.dueDate,
      totalLessons,
      completedLessons,
      // Extra bookkeeping so the UI can tell "lectures done, test still pending" apart.
      requiredTests: requiredTestIds.length,
      passedRequiredTests: passedRequired,
      progressPercent: totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0,
      course,
    }
  })

  res.json({ enrollments })
})
