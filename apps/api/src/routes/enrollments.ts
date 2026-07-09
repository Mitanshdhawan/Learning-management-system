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
    const totalLessons = modules.reduce((sum, m) => sum + m._count.lessons, 0)
    const completedLessons = e.lessonProgress.length
    return {
      id: e.id,
      status: e.status,
      totalLessons,
      completedLessons,
      progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      course,
    }
  })

  res.json({ enrollments })
})
