import type { UserRole } from '@toplms/db'
import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../lib/jwt'
import { HttpError } from './error'

/** Requires a valid access token in the Authorization header. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or invalid Authorization header')
  }

  const token = header.slice('Bearer '.length)
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub, role: payload.role }
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }

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
