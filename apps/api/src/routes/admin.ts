import { prisma } from '@toplms/db'
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'

export const adminRouter = Router()

// GET /api/admin/overview — headline counts for the admin dashboard.
adminRouter.get('/overview', requireAuth, requireRole('admin'), async (_req, res) => {
  const now = new Date()
  const [totalUsers, admins, managers, employees, pendingInvites, courses] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { role: 'manager' } }),
    prisma.user.count({ where: { role: 'employee' } }),
    prisma.invitation.count({ where: { acceptedAt: null, expiresAt: { gt: now } } }),
    prisma.course.count(),
  ])

  res.json({ totalUsers, admins, managers, employees, pendingInvites, courses })
})
