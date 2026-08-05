import { prisma } from '@toplms/db'
import { updateUserSchema, userStatusSchema } from '@toplms/validation'
import { Router } from 'express'
import { saveImage, uploadImage } from '../lib/uploads'
import { safeUserSelect } from '../lib/user'
import { requireAuth } from '../middleware/auth'
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

// POST /api/users/:id/avatar — admin (any user) or a manager (their own report) sets a photo.
usersRouter.post(
  '/:id/avatar',
  requireAuth,
  uploadImage.single('avatar'),
  async (req, res) => {
    const me = req.user!
    const id = String(req.params.id)
    const file = req.file
    if (!file) throw new HttpError(400, 'No image uploaded')

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, managerId: true } })
    if (!target) throw new HttpError(404, 'User not found')
    if (me.role !== 'admin' && !(me.role === 'manager' && target.managerId === me.id)) {
      throw new HttpError(403, 'You can only edit your own team members')
    }

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
      where: { id },
      data: { avatarId: media.id },
      select: safeUserSelect,
    })

    res.json({ user })
  },
)

// PATCH /api/users/:id — admins edit any field; a manager edits only their own report's name.
usersRouter.patch('/:id', requireAuth, validateBody(updateUserSchema), async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)
  const { managerId, role, fullName, canCreateCourses, canManageAllCourses } = req.body

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new HttpError(404, 'User not found')

  const isAdmin = me.role === 'admin'
  const isManagerOfTarget = me.role === 'manager' && target.managerId === me.id
  if (!isAdmin && !isManagerOfTarget) throw new HttpError(403, 'You can only edit your own team members')

  const data: {
    managerId?: string | null
    role?: 'admin' | 'manager' | 'employee'
    fullName?: string
    canCreateCourses?: boolean
    canManageAllCourses?: boolean
  } = {}

  if (fullName !== undefined) data.fullName = fullName

  // Managers may change their report's name and role; reassigning the reporting
  // line and course permissions stay admin-only.
  if (!isAdmin) {
    if (managerId !== undefined || canCreateCourses !== undefined || canManageAllCourses !== undefined) {
      throw new HttpError(403, "Managers can't reassign reporting lines or change course permissions")
    }
    if (role !== undefined && role !== target.role) {
      if (role === 'admin' || target.role === 'admin') {
        throw new HttpError(403, 'Managers cannot assign or change admin roles')
      }
      data.role = role
    }
  } else {
    if (canCreateCourses !== undefined) data.canCreateCourses = canCreateCourses
    if (canManageAllCourses !== undefined) data.canManageAllCourses = canManageAllCourses

    if (managerId !== undefined) {
      if (managerId) {
        if (managerId === id) throw new HttpError(400, 'A user cannot report to themselves')
        const manager = await prisma.user.findUnique({ where: { id: managerId } })
        if (!manager || (manager.role !== 'manager' && manager.role !== 'admin')) {
          throw new HttpError(400, 'managerId must reference a manager or an admin')
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
  }

  const user = await prisma.user.update({ where: { id }, data, select: safeUserSelect })
  res.json({ user })
})

// PATCH /api/users/:id/status — block or restore a user's ability to sign in.
// Admin can manage anyone; a manager only their own reports (never an admin).
usersRouter.patch('/:id/status', requireAuth, validateBody(userStatusSchema), async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)
  const { status } = req.body as { status: 'active' | 'deactivated' }

  if (id === me.id) throw new HttpError(400, "You can't change your own access")

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new HttpError(404, 'User not found')

  const isAdmin = me.role === 'admin'
  const isManagerOfTarget = me.role === 'manager' && target.managerId === me.id
  if (!isAdmin && !isManagerOfTarget) throw new HttpError(403, 'You can only manage your own team members')
  if (!isAdmin && target.role === 'admin') throw new HttpError(403, "You can't change an admin's access")

  // Only a user who has actually joined can be blocked/restored (invites are separate).
  if (target.status === 'invited') {
    throw new HttpError(400, 'This user has not accepted their invitation yet')
  }
  // Never lock out the last remaining admin.
  if (status === 'deactivated' && target.role === 'admin') {
    const activeAdmins = await prisma.user.count({ where: { role: 'admin', status: 'active' } })
    if (activeAdmins <= 1) throw new HttpError(400, 'Cannot block the last active admin')
  }

  const user = await prisma.user.update({ where: { id }, data: { status }, select: safeUserSelect })
  res.json({ user })
})

// DELETE /api/users/:id — admin deletes anyone; a manager deletes their own report.
usersRouter.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new HttpError(404, 'User not found')

  const isAdmin = me.role === 'admin'
  const isManagerOfTarget = me.role === 'manager' && target.managerId === me.id
  if (!isAdmin && !isManagerOfTarget) throw new HttpError(403, 'You can only delete your own team members')
  if (!isAdmin && target.role === 'admin') throw new HttpError(403, 'You cannot delete an admin')

  if (target.role === 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } })
    if (admins <= 1) throw new HttpError(400, 'Cannot delete the last admin')
  }

  // Guard: never erase an author out from under their courses — those may have
  // other learners enrolled. Their courses must be reassigned or removed first.
  const createdCourses = await prisma.course.count({ where: { createdById: id } })
  if (createdCourses > 0) {
    const s = createdCourses === 1 ? '' : 's'
    throw new HttpError(
      409,
      `Cannot delete: this user created ${createdCourses} course${s}. Reassign or delete those course${s} first.`,
    )
  }

  try {
    // Cascade the user's own records, then the user. Deleting their enrollments
    // cascades attempts, lesson progress, answers and certificates; test
    // allowances and notifications cascade on the user delete itself. Reports and
    // any records they authored elsewhere (uploads, assignments) are set null.
    await prisma.$transaction([
      // Invitations they sent, plus any pending invite addressed to them.
      prisma.invitation.deleteMany({ where: { invitedById: id } }),
      prisma.invitation.deleteMany({ where: { email: target.email, acceptedAt: null } }),
      // Their enrollments → attempts, progress, answers, certificates (all cascade).
      prisma.enrollment.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ])
  } catch {
    throw new HttpError(409, 'Cannot delete: this user still has related records that must be removed first.')
  }

  res.status(204).end()
})
