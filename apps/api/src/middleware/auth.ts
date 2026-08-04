import { prisma } from '@toplms/db'
import type { UserRole } from '@toplms/db'
import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../lib/jwt'
import { HttpError } from './error'

/** Signal the client can use to sign a blocked user out immediately. */
export const ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED'

/**
 * Requires a valid access token, then re-checks the account on every request.
 * The token is only proof of who you were up to 15 minutes ago — the live
 * lookup means a block (or deletion, or role change) takes effect instantly
 * rather than lingering until the token expires.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or invalid Authorization header')
  }

  const token = header.slice('Bearer '.length)
  let sub: string
  try {
    sub = verifyAccessToken(token).sub
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }

  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, role: true, status: true },
  })
  if (!user) throw new HttpError(401, 'Your session is no longer valid')
  if (user.status === 'deactivated') {
    throw new HttpError(403, 'Your access has been blocked. Please contact your manager.', ACCOUNT_BLOCKED)
  }

  // Use the live role, so a role change also takes effect without re-login.
  req.user = { id: user.id, role: user.role }
  next()
}

/** Requires the authenticated user to have one of the given roles. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, 'Unauthenticated')
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'Forbidden')
    next()
  }
}
