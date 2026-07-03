import type { UserRole } from '@toplms/db'

// Augment Express's Request with the authenticated user set by requireAuth.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole }
    }
  }
}
