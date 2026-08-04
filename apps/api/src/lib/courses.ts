import { randomBytes } from 'node:crypto'
import { type Prisma, prisma } from '@toplms/db'
import { HttpError } from '../middleware/error'

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base || 'course'
}

export async function uniqueCourseSlug(title: string): Promise<string> {
  const base = slugify(title)
  const existing = await prisma.course.findUnique({ where: { slug: base }, select: { id: true } })
  return existing ? `${base}-${randomBytes(3).toString('hex')}` : base
}

/** Admins can always create; managers if they may author their own OR edit all courses. */
export async function canCreateCourses(userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true
  if (role === 'manager') {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { canCreateCourses: true, canManageAllCourses: true },
    })
    return Boolean(u?.canCreateCourses || u?.canManageAllCourses)
  }
  return false
}

/**
 * Throws unless the user may edit the course. Allowed: admins, the course's
 * creator (the "edit own" grant), or a manager with the "edit all" grant.
 */
export async function assertCanEditCourse(courseId: string, user: { id: string; role: string }) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, createdById: true },
  })
  if (!course) throw new HttpError(404, 'Course not found')
  if (user.role === 'admin' || course.createdById === user.id) return course
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { canManageAllCourses: true },
  })
  if (u?.canManageAllCourses) return course
  throw new HttpError(403, 'You do not have permission to edit this course')
}

const mediaSelect = {
  id: true,
  storageKey: true,
  provider: true,
  durationSeconds: true,
  fileName: true,
  kind: true,
} satisfies Prisma.MediaAssetSelect

export const lessonResourceSelect = {
  id: true,
  title: true,
  media: { select: mediaSelect },
} satisfies Prisma.LessonResourceSelect

export const courseSummarySelect = {
  id: true,
  title: true,
  slug: true,
  subtitle: true,
  status: true,
  level: true,
  language: true,
  certificateEnabled: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  thumbnail: { select: mediaSelect },
  category: { select: { id: true, name: true, slug: true } },
  createdBy: {
    select: { id: true, fullName: true, avatar: { select: { storageKey: true, provider: true } } },
  },
  _count: { select: { enrollments: true, modules: true } },
} satisfies Prisma.CourseSelect

// Lightweight test info shown alongside a module (does a section have a test? is it required?).
export const testSummarySelect = {
  id: true,
  title: true,
  isRequired: true,
  passingScore: true,
  maxAttempts: true,
  _count: { select: { questions: true } },
} satisfies Prisma.TestSelect

// Full test with questions + options + correct answers — for the course creator's editor.
export const testEditSelect = {
  id: true,
  title: true,
  isRequired: true,
  passingScore: true,
  maxAttempts: true,
  questions: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      questionText: true,
      type: true,
      points: true,
      position: true,
      correctText: true,
      options: {
        orderBy: { position: 'asc' },
        select: { id: true, optionText: true, isCorrect: true, position: true },
      },
    },
  },
} satisfies Prisma.TestSelect

// Test as a learner sees it while attempting — no correct answers leak to the client.
export const testTakeSelect = {
  id: true,
  title: true,
  isRequired: true,
  passingScore: true,
  maxAttempts: true,
  questions: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      questionText: true,
      type: true,
      points: true,
      position: true,
      options: { orderBy: { position: 'asc' }, select: { id: true, optionText: true, position: true } },
    },
  },
} satisfies Prisma.TestSelect

/**
 * How many attempts this learner gets at a test: a per-user allowance wins over the
 * test's own limit; null means unlimited.
 */
export async function attemptLimitFor(
  testId: string,
  userId: string,
  testMaxAttempts: number | null,
): Promise<number | null> {
  const allowance = await prisma.testAllowance.findUnique({
    where: { testId_userId: { testId, userId } },
    select: { maxAttempts: true },
  })
  return allowance?.maxAttempts ?? testMaxAttempts ?? null
}

/**
 * Recompute an enrollment's progress and status from completed lessons AND passed
 * required tests. A course is only "completed" once every required test is passed.
 */
export async function recomputeEnrollmentProgress(enrollmentId: string, courseId: string) {
  const [totalLessons, doneLessons, requiredTests, passedRequired] = await Promise.all([
    prisma.lesson.count({ where: { module: { courseId } } }),
    prisma.lessonProgress.count({ where: { enrollmentId, status: 'completed' } }),
    prisma.test.count({ where: { module: { courseId }, isRequired: true } }),
    prisma.test.count({
      where: { module: { courseId }, isRequired: true, attempts: { some: { enrollmentId, passed: true } } },
    }),
  ])
  const total = totalLessons + requiredTests
  const done = doneLessons + passedRequired
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0
  const status = progressPercent >= 100 ? 'completed' : progressPercent > 0 ? 'in_progress' : 'not_started'
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { progressPercent, status, completedAt: status === 'completed' ? new Date() : null },
  })
  return { progressPercent, status }
}

export const courseDetailSelect = {
  ...courseSummarySelect,
  description: true,
  learningOutcomes: true,
  requirements: true,
  previewVideo: { select: mediaSelect },
  modules: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      position: true,
      lessons: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          type: true,
          position: true,
          videoDurationSeconds: true,
          isPreview: true,
          contentHtml: true,
          video: { select: mediaSelect },
          resources: { orderBy: { position: 'asc' }, select: lessonResourceSelect },
        },
      },
      test: { select: testSummarySelect },
    },
  },
} satisfies Prisma.CourseSelect

interface StatModule {
  lessons: { type: string; videoDurationSeconds: number | null }[]
}

export function courseStats(course: { modules: StatModule[]; _count: { enrollments: number } }) {
  const lessons = course.modules.flatMap((m) => m.lessons)
  return {
    moduleCount: course.modules.length,
    lectureCount: lessons.length,
    videoCount: lessons.filter((l) => l.type === 'video').length,
    articleCount: lessons.filter((l) => l.type === 'reading').length,
    totalDurationSeconds: lessons.reduce((sum, l) => sum + (l.videoDurationSeconds ?? 0), 0),
    studentCount: course._count.enrollments,
  }
}
