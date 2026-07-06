import { prisma } from '@toplms/db'
import { Router } from 'express'
import { assertCanEditCourse } from '../lib/courses'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'

export const resourcesRouter = Router()

// DELETE /api/resources/:id — detach a resource from its lesson.
resourcesRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id)
  const resource = await prisma.lessonResource.findUnique({
    where: { id },
    select: { lesson: { select: { module: { select: { courseId: true } } } } },
  })
  if (!resource) throw new HttpError(404, 'Resource not found')
  await assertCanEditCourse(resource.lesson.module.courseId, req.user!)
  await prisma.lessonResource.delete({ where: { id } })
  res.status(204).end()
})
