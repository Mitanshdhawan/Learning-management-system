import { prisma } from '@toplms/db'
import { inviteAcceptSchema, loginSchema, updateMeSchema } from '@toplms/validation'
import { Router, type Response } from 'express'
import { env } from '../env'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { hashPassword, verifyPassword } from '../lib/password'
import { safeUserSelect } from '../lib/user'
import { ACCOUNT_BLOCKED, requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const authRouter = Router()

const REFRESH_COOKIE = 'refreshToken'
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function setRefreshCookie(res: Response, userId: string) {
  res.cookie(REFRESH_COOKIE, signRefreshToken(userId), {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE_MS,
  })
}

// POST /api/auth/accept — set name + password from an invite, then auto-login.
authRouter.post('/accept', validateBody(inviteAcceptSchema), async (req, res) => {
  const { token, fullName, password } = req.body
  const invite = await prisma.invitation.findUnique({ where: { token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new HttpError(400, 'Invitation is invalid or has expired')
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.upsert({
    where: { email: invite.email },
    update: {
      fullName,
      passwordHash,
      status: 'active',
      role: invite.role,
      managerId: invite.managerId ?? undefined,
    },
    create: {
      email: invite.email,
      fullName,
      passwordHash,
      status: 'active',
      role: invite.role,
      managerId: invite.managerId ?? undefined,
    },
    select: safeUserSelect,
  })

  await prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })

  setRefreshCookie(res, user.id)
  res.status(201).json({ user, accessToken: signAccessToken({ sub: user.id, role: user.role }) })
})

// POST /api/auth/login
authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body
  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing || !existing.passwordHash) {
    throw new HttpError(401, 'Invalid credentials')
  }
  // Verify the password before revealing anything about the account status, so a
  // "blocked" message only ever reaches someone with the right credentials.
  if (!(await verifyPassword(password, existing.passwordHash))) {
    throw new HttpError(401, 'Invalid credentials')
  }
  if (existing.status === 'deactivated') {
    throw new HttpError(403, 'Your access has been blocked. Please contact your manager.', ACCOUNT_BLOCKED)
  }
  if (existing.status !== 'active') {
    throw new HttpError(401, 'Invalid credentials')
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { lastLoginAt: new Date() },
    select: safeUserSelect,
  })

  setRefreshCookie(res, user.id)
  res.json({ user, accessToken: signAccessToken({ sub: user.id, role: user.role }) })
})

// POST /api/auth/refresh — issue a new access token from the refresh cookie.
authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE]
  if (!token) throw new HttpError(401, 'No refresh token')

  let userId: string
  try {
    userId = verifyRefreshToken(token).sub
  } catch {
    throw new HttpError(401, 'Invalid refresh token')
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUserSelect })
  if (!user || user.status !== 'active') throw new HttpError(401, 'User is not active')

  setRefreshCookie(res, user.id)
  res.json({ accessToken: signAccessToken({ sub: user.id, role: user.role }) })
})

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  res.status(204).end()
})

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: safeUserSelect })
  if (!user) throw new HttpError(404, 'User not found')
  // A user blocked mid-session is signed out the next time the app loads /me.
  if (user.status === 'deactivated') {
    throw new HttpError(403, 'Your access has been blocked. Please contact your manager.', ACCOUNT_BLOCKED)
  }
  res.json({ user })
})

// PATCH /api/auth/me — update own profile (full name, theme preference).
authRouter.patch('/me', requireAuth, validateBody(updateMeSchema), async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: req.body,
    select: safeUserSelect,
  })
  res.json({ user })
})
