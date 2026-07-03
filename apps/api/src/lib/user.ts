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
} satisfies Prisma.UserSelect
