import { prisma } from '@toplms/db'
import { lessonCreateSchema, moduleUpdateSchema } from '@toplms/validation'
import { Router } from 'express'
import { assertCanEditCourse } from '../lib/courses'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const modulesRouter = Router()

async function moduleCourseId(id: string): Promise<string> {
  const m = await prisma.module.findUnique({ where: { id }, select: { courseId: true } })
  if (!m) throw new HttpError(404, 'Module not found')
  return m.courseId
}

// PATCH /api/modules/:id — rename / re-describe / reorder.
modulesRouter.patch('/:id', requireAuth, validateBody(moduleUpdateSchema), async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(id), req.user!)
  const module = await prisma.module.update({ where: { id }, data: req.body })
  res.json({ module })
})

// DELETE /api/modules/:id
modulesRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(id), req.user!)
  await prisma.module.delete({ where: { id } })
  res.status(204).end()
})

// POST /api/modules/:id/lessons — add a lesson (position auto-appended).
modulesRouter.post('/:id/lessons', requireAuth, validateBody(lessonCreateSchema), async (req, res) => {
  const moduleId = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(moduleId), req.user!)

  const last = await prisma.lesson.findFirst({
    where: { moduleId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const lesson = await prisma.lesson.create({
    data: { moduleId, position: (last?.position ?? -1) + 1, ...req.body },
  })
  res.status(201).json({ lesson })
})
