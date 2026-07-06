import { prisma } from '@toplms/db'
import { categoryCreateSchema } from '@toplms/validation'
import { Router } from 'express'
import { slugify } from '../lib/courses'
import { requireAuth, requireRole } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const categoriesRouter = Router()

// GET /api/categories — public list.
categoriesRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  res.json({ categories })
})

// POST /api/categories — admin creates a category.
categoriesRouter.post('/', requireAuth, requireRole('admin'), validateBody(categoryCreateSchema), async (req, res) => {
  const { name, description } = req.body
  const slug = slugify(name)
  const existing = await prisma.category.findUnique({ where: { slug } })
  if (existing) throw new HttpError(409, 'A category with this name already exists')
  const category = await prisma.category.create({ data: { name, slug, description } })
  res.status(201).json({ category })
})
