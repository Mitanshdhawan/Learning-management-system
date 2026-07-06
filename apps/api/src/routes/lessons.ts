import { prisma } from '@toplms/db'
import { lessonResourceCreateSchema, lessonUpdateSchema } from '@toplms/validation'
import { Router } from 'express'
import { assertCanEditCourse, lessonResourceSelect } from '../lib/courses'
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
