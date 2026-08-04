import { prisma } from '@toplms/db'
import { lessonProgressSchema, lessonResourceCreateSchema, lessonUpdateSchema } from '@toplms/validation'
import { Router } from 'express'
import { assertCanEditCourse, lessonResourceSelect, recomputeEnrollmentProgress } from '../lib/courses'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const lessonsRouter = Router()

async function lessonCourseId(id: string): Promise<string> {
  const l = await prisma.lesson.findUnique({
    where: { id },
    select: { module: { select: { courseId: true } } },
  })
  if (!l) throw new HttpError(404, 'Lesson not found')
  return l.module.courseId
}

// PATCH /api/lessons/:id — edit a lesson (title, type, video, content, preview, reorder).
lessonsRouter.patch('/:id', requireAuth, validateBody(lessonUpdateSchema), async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(await lessonCourseId(id), req.user!)

  // Preview rule: only a video lecture can be the preview, and only one across the whole course.
  if (req.body.isPreview === true) {
    const current = await prisma.lesson.findUnique({
      where: { id },
      select: { type: true, module: { select: { courseId: true } } },
    })
    if (!current) throw new HttpError(404, 'Lesson not found')
    const nextType = req.body.type ?? current.type
    if (nextType !== 'video') {
      throw new HttpError(400, 'Only video lectures can be set as the preview')
    }

    const [, lesson] = await prisma.$transaction([
      // Clear the preview flag from every other lecture in the course…
      prisma.lesson.updateMany({
        where: { module: { courseId: current.module.courseId }, id: { not: id } },
        data: { isPreview: false },
      }),
      // …then set it on this one.
      prisma.lesson.update({ where: { id }, data: req.body }),
    ])
    res.json({ lesson })
    return
  }

  const lesson = await prisma.lesson.update({ where: { id }, data: req.body })
  res.json({ lesson })
})

// DELETE /api/lessons/:id
lessonsRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(await lessonCourseId(id), req.user!)
  await prisma.lesson.delete({ where: { id } })
  res.status(204).end()
})

// POST /api/lessons/:id/resources — attach an uploaded file (reading PDF, etc.) to a lesson.
lessonsRouter.post('/:id/resources', requireAuth, validateBody(lessonResourceCreateSchema), async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(await lessonCourseId(id), req.user!)

  const last = await prisma.lessonResource.findFirst({
    where: { lessonId: id },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const resource = await prisma.lessonResource.create({
    data: {
      lessonId: id,
      mediaId: req.body.mediaId,
      title: req.body.title ?? null,
      position: (last?.position ?? -1) + 1,
    },
    select: lessonResourceSelect,
  })
  res.status(201).json({ resource })
})

// POST /api/lessons/:id/progress — mark a lesson complete/incomplete for the current learner.
lessonsRouter.post('/:id/progress', requireAuth, validateBody(lessonProgressSchema), async (req, res) => {
  const id = String(req.params.id)
  const courseId = await lessonCourseId(id)
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
    select: { id: true },
  })
  if (!enrollment) throw new HttpError(403, 'You are not enrolled in this course')

  const completed: boolean = req.body.completed
  const progressData = {
    status: completed ? ('completed' as const) : ('in_progress' as const),
    completedAt: completed ? new Date() : null,
    lastAccessedAt: new Date(),
  }
  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: id } },
    update: progressData,
    create: { enrollmentId: enrollment.id, lessonId: id, ...progressData },
  })

  // Recompute overall course progress (completed lessons + passed required tests).
  const { progressPercent, status } = await recomputeEnrollmentProgress(enrollment.id, courseId)

  res.json({ lessonId: id, completed, progressPercent, status })
})
