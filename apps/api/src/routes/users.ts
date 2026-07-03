import { prisma } from '@toplms/db'
import { updateUserSchema } from '@toplms/validation'
import { Router } from 'express'
import { saveImage, uploadImage } from '../lib/uploads'
import { safeUserSelect } from '../lib/user'
import { requireAuth, requireRole } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const usersRouter = Router()

// GET /api/users — admin sees everyone; a manager sees their direct reports.
usersRouter.get('/', requireAuth, async (req, res) => {
  const me = req.user!

  if (me.role === 'admin') {
    const users = await prisma.user.findMany({ select: safeUserSelect, orderBy: { createdAt: 'desc' } })
    res.json({ users })
    return
  }

  if (me.role === 'manager') {
    const users = await prisma.user.findMany({
      where: { managerId: me.id },
      select: safeUserSelect,
      orderBy: { createdAt: 'desc' },
    })
    res.json({ users })
    return
  }

  throw new HttpError(403, 'Forbidden')
})

// POST /api/users/me/avatar — upload your own profile picture.
usersRouter.post('/me/avatar', requireAuth, uploadImage.single('avatar'), async (req, res) => {
  const file = req.file
  if (!file) throw new HttpError(400, 'No image uploaded')

  const stored = await saveImage(file, 'avatars')

  const media = await prisma.mediaAsset.create({
    data: {
      kind: 'image',
      provider: stored.provider,
      storageKey: stored.storageKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: BigInt(file.size),
      width: stored.width,
      height: stored.height,
      uploadedById: req.user!.id,
    },
  })

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatarId: media.id },
    select: safeUserSelect,
  })

  res.json({ user })
})

// PATCH /api/users/:id — admin updates a user's manager and/or role.
usersRouter.patch('/:id', requireAuth, requireRole('admin'), validateBody(updateUserSchema), async (req, res) => {
  const id = String(req.params.id)
  const { managerId, role } = req.body

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new HttpError(404, 'User not found')

  const data: { managerId?: string | null; role?: 'admin' | 'manager' | 'employee' } = {}

  if (managerId !== undefined) {
    if (managerId) {
      if (managerId === id) throw new HttpError(400, 'A user cannot report to themselves')
      const manager = await prisma.user.findUnique({ where: { id: managerId } })
      if (!manager || manager.role !== 'manager') {
        throw new HttpError(400, 'managerId must reference a manager')
      }
    }
    data.managerId = managerId
  }

  if (role !== undefined && role !== target.role) {
    if (target.role === 'admin' && role !== 'admin') {
      const admins = await prisma.user.count({ where: { role: 'admin' } })
      if (admins <= 1) throw new HttpError(400, 'Cannot change the role of the last admin')
    }
    data.role = role
  }

  const user = await prisma.user.update({ where: { id }, data, select: safeUserSelect })
  res.json({ user })
})

// DELETE /api/users/:id — admin deletes a user account.
usersRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = String(req.params.id)

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new HttpError(404, 'User not found')

  if (target.role === 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } })
    if (admins <= 1) throw new HttpError(400, 'Cannot delete the last admin')
  }

  try {
    await prisma.user.delete({ where: { id } })
  } catch {
    throw new HttpError(409, 'Cannot delete: this user still has related records (courses, invitations, etc.)')
  }

  res.status(204).end()
})
