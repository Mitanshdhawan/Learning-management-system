import type { Prisma } from '@toplms/db'

// The only user fields safe to return in API responses (never passwordHash).
export const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  theme: true,
  managerId: true,
  canCreateCourses: true,
  avatarId: true,
  createdAt: true,
  avatar: { select: { storageKey: true, provider: true } },
  manager: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.UserSelect
