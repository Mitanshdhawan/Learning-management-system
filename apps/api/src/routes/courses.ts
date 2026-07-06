import { prisma } from '@toplms/db'
import { courseCreateSchema, courseUpdateSchema, moduleCreateSchema } from '@toplms/validation'
import { Router } from 'express'
import {
  assertCanEditCourse,
  canCreateCourses,
  courseDetailSelect,
  courseStats,
  courseSummarySelect,
  uniqueCourseSlug,
} from '../lib/courses'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const coursesRouter = Router()

// POST /api/courses — create a course (admin, or a manager with canCreateCourses).
coursesRouter.post('/', requireAuth, validateBody(courseCreateSchema), async (req, res) => {
  const me = req.user!
  if (!(await canCreateCourses(me.id, me.role))) {
    throw new HttpError(403, 'You do not have permission to create courses')
  }

  const {
    title,
    subtitle,
    description,
    categoryId,
    language,
    level,
    learningOutcomes,
    requirements,
    certificateEnabled,
  } = req.body

  const slug = await uniqueCourseSlug(title)
  const course = await prisma.course.create({
    data: {
      title,
      slug,
      createdById: me.id,
      subtitle,
      description,
      categoryId,
      language,
      level,
      learningOutcomes,
      requirements,
      certificateEnabled,
    },
    select: courseSummarySelect,
  })
  res.status(201).json({ course })
})

// GET /api/courses — admins see everything; others see published courses + their own.
coursesRouter.get('/', requireAuth, async (req, res) => {
  const me = req.user!
  const where =
    me.role === 'admin'
      ? {}
      : { OR: [{ status: 'published' as const }, { createdById: me.id }] }

  const courses = await prisma.course.findMany({
    where,
    select: courseSummarySelect,
    orderBy: { createdAt: 'desc' },
  })
  res.json({ courses })
})

// GET /api/courses/:slug — full detail for the course overview page.
coursesRouter.get('/:slug', requireAuth, async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { slug: String(req.params.slug) },
    select: courseDetailSelect,
  })
  if (!course) throw new HttpError(404, 'Course not found')
  res.json({ course, stats: courseStats(course) })
})

// PATCH /api/courses/:id — update (admin or creator).
coursesRouter.patch('/:id', requireAuth, validateBody(courseUpdateSchema), async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(id, req.user!)

  const data = { ...req.body }
  if (req.body.status === 'published') data.publishedAt = new Date()

  const course = await prisma.course.update({ where: { id }, data, select: courseSummarySelect })
  res.json({ course })
})

// DELETE /api/courses/:id
coursesRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(id, req.user!)
  await prisma.course.delete({ where: { id } })
  res.status(204).end()
})

// POST /api/courses/:id/modules — add a module (position auto-appended).
coursesRouter.post('/:id/modules', requireAuth, validateBody(moduleCreateSchema), async (req, res) => {
  const courseId = String(req.params.id)
  await assertCanEditCourse(courseId, req.user!)

  const last = await prisma.module.findFirst({
    where: { courseId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const module = await prisma.module.create({
    data: { courseId, position: (last?.position ?? -1) + 1, ...req.body },
  })
  res.status(201).json({ module })
})
