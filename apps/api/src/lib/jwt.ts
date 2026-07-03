import type { UserRole } from '@toplms/db'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../env'

export interface AccessPayload {
  sub: string
  role: UserRole
}

const accessOpts: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] }
const refreshOpts: SignOptions = { expiresIn: env.REFRESH_TOKEN_TTL as SignOptions['expiresIn'] }

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, accessOpts)
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload
}

export function signRefreshToken(sub: string): string {
  return jwt.sign({ sub }, env.JWT_REFRESH_SECRET, refreshOpts)
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string }
}
