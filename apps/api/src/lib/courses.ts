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

/** Admins can always create; managers only if their canCreateCourses flag is set. */
export async function canCreateCourses(userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true
  if (role === 'manager') {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { canCreateCourses: true } })
    return Boolean(u?.canCreateCourses)
  }
  return false
}

/** Throws unless the user is an admin or the course's creator. Returns the course. */
export async function assertCanEditCourse(courseId: string, user: { id: string; role: string }) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, createdById: true },
  })
  if (!course) throw new HttpError(404, 'Course not found')
  if (user.role !== 'admin' && course.createdById !== user.id) {
    throw new HttpError(403, 'You can only edit your own courses')
  }
  return course
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
