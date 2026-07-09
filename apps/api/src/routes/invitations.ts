import { randomBytes } from 'node:crypto'
import { prisma } from '@toplms/db'
import { inviteCreateSchema } from '@toplms/validation'
import { Router } from 'express'
import { env } from '../env'
import { sendInviteEmail } from '../lib/email'
import { requireAuth, requireRole } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const invitationsRouter = Router()

const INVITE_TTL_DAYS = 7

// POST /api/invitations — admin invites a user by email.
invitationsRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validateBody(inviteCreateSchema),
  async (req, res) => {
    const { email, role, managerId } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing?.status === 'active') {
      throw new HttpError(409, 'A user with this email is already active')
    }

    if (managerId) {
      const manager = await prisma.user.findUnique({ where: { id: managerId } })
      if (!manager || (manager.role !== 'manager' && manager.role !== 'admin')) {
        throw new HttpError(400, 'managerId must reference a manager or an admin')
      }
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        managerId: managerId ?? null,
        invitedById: req.user!.id,
        token,
        expiresAt,
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    })

    // Make the invitee show up as a pending user right away.
    await prisma.user.upsert({
      where: { email },
      update: { role, managerId: managerId ?? undefined },
      create: { email, role, managerId: managerId ?? undefined, status: 'invited' },
    })

    const acceptUrl = `${env.WEB_APP_URL}/invite/${token}`
    await sendInviteEmail(email, acceptUrl)

    res.status(201).json({
      invitation,
      ...(env.NODE_ENV === 'development' ? { devAcceptUrl: acceptUrl } : {}),
    })
  },
)

// GET /api/invitations/:token — validate an invite link (public).
invitationsRouter.get('/:token', async (req, res) => {
  const invite = await prisma.invitation.findUnique({
    where: { token: req.params.token },
    select: { email: true, role: true, expiresAt: true, acceptedAt: true },
  })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new HttpError(404, 'Invitation is invalid or has expired')
  }
  res.json({ email: invite.email, role: invite.role })
})
