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
export const courseLevels = ['beginner', 'intermediate', 'advanced', 'all_levels'] as const
export const courseLevelSchema = z.enum(courseLevels)
export type CourseLevel = z.infer<typeof courseLevelSchema>

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>

export const courseCreateSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(20000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  language: z.string().min(1).max(50).optional(),
  level: courseLevelSchema.optional(),
  learningOutcomes: z.array(z.string().min(1).max(300)).max(40).optional(),
  requirements: z.array(z.string().min(1).max(300)).max(40).optional(),
  certificateEnabled: z.boolean().optional(),
})
export type CourseCreateInput = z.infer<typeof courseCreateSchema>

export const courseUpdateSchema = courseCreateSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  thumbnailId: z.string().uuid().nullable().optional(),
  previewVideoId: z.string().uuid().nullable().optional(),
})
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>

export const moduleCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})
export type ModuleCreateInput = z.infer<typeof moduleCreateSchema>

export const moduleUpdateSchema = moduleCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
})

export const lessonCreateSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['video', 'reading']).default('video'),
  videoId: z.string().uuid().optional(),
  videoDurationSeconds: z.number().int().min(0).optional(),
  contentHtml: z.string().max(200000).optional(),
  isPreview: z.boolean().optional(),
})
export type LessonCreateInput = z.infer<typeof lessonCreateSchema>

export const lessonUpdateSchema = lessonCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
})

// Attach an uploaded file (PDF / video) to a lesson as a resource.
export const lessonResourceCreateSchema = z.object({
  mediaId: z.string().uuid(),
  title: z.string().max(200).optional(),
})
export type LessonResourceCreateInput = z.infer<typeof lessonResourceCreateSchema>

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
