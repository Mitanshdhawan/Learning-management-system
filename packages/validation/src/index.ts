import { z } from 'zod'

// Roles mirror the Prisma UserRole enum (kept local so this package has no db dependency).
export const userRoles = ['admin', 'manager', 'employee'] as const
export const roleSchema = z.enum(userRoles)
export type Role = z.infer<typeof roleSchema>

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
export type LoginInput = z.infer<typeof loginSchema>

// ---- Invitations (admin invites by email) ----
export const inviteCreateSchema = z.object({
  email: z.string().email(),
  role: roleSchema.default('employee'),
  managerId: z.string().uuid().optional(),
})
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>

export const inviteAcceptSchema = z.object({
  token: z.string().min(10),
  fullName: z.string().min(1).max(120),
  password: z.string().min(8),
})
export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>

// ---- Courses ----
export const courseCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
})
export type CourseCreateInput = z.infer<typeof courseCreateSchema>

// ---- Profile / preferences ----
export const themeSchema = z.enum(['light', 'dark'])
export type ThemeValue = z.infer<typeof themeSchema>

export const updateMeSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  theme: themeSchema.optional(),
})
export type UpdateMeInput = z.infer<typeof updateMeSchema>

// Admin editing another user. managerId: uuid = assign, null = unassign, omit = no change.
export const updateUserSchema = z.object({
  managerId: z.string().uuid().nullable().optional(),
  role: roleSchema.optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>
