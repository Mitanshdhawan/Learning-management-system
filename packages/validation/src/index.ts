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

// Mark a lesson complete / incomplete for the current learner.
export const lessonProgressSchema = z.object({
  completed: z.boolean(),
})
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>

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
  fullName: z.string().min(1).max(120).optional(),
  managerId: z.string().uuid().nullable().optional(),
  role: roleSchema.optional(),
  canCreateCourses: z.boolean().optional(),
  canManageAllCourses: z.boolean().optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

// Block / unblock a user's ability to sign in.
export const userStatusSchema = z.object({
  status: z.enum(['active', 'deactivated']),
})
export type UserStatusInput = z.infer<typeof userStatusSchema>

// ---- Tests / assessments (MCQ only, auto-graded) ----
export const questionTypes = ['single_choice', 'multiple_choice', 'true_false'] as const
export const questionTypeSchema = z.enum(questionTypes)
export type QuestionTypeValue = z.infer<typeof questionTypeSchema>

export const testQuestionSchema = z.object({
  type: questionTypeSchema,
  questionText: z.string().min(1).max(1000),
  points: z.number().int().min(1).max(100).default(1),
  options: z
    .array(z.object({ text: z.string().min(1).max(500), isCorrect: z.boolean().default(false) }))
    .min(2)
    .max(10),
})

export const testUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  isRequired: z.boolean().default(true),
  passingScore: z.number().int().min(0).max(100).default(70),
  // null / omitted = unlimited attempts
  maxAttempts: z.number().int().min(1).max(50).nullable().optional(),
  questions: z.array(testQuestionSchema).min(1).max(50),
})
export type TestUpsertInput = z.infer<typeof testUpsertSchema>

// Admin/manager raising or lowering one learner's attempt limit for a test.
export const testAllowanceSchema = z.object({
  testId: z.string().uuid(),
  maxAttempts: z.number().int().min(1).max(50),
})
export type TestAllowanceInput = z.infer<typeof testAllowanceSchema>

// A manager/admin assigning a course to a team member as mandatory.
export const assignCourseSchema = z.object({
  courseId: z.string().uuid(),
  dueDate: z.coerce.date().nullable().optional(),
})
export type AssignCourseInput = z.infer<typeof assignCourseSchema>

// A learner submitting an attempt: the selected option(s) per question,
// plus the proctoring footage uploaded just before submitting.
export const testSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selectedOptionIds: z.array(z.string().uuid()).default([]),
      }),
    )
    .min(1),
  screenRecordingId: z.string().uuid().nullable().optional(),
  cameraRecordingId: z.string().uuid().nullable().optional(),
})
export type TestSubmitInput = z.infer<typeof testSubmitSchema>
