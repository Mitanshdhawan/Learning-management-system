import { API_ORIGIN } from './api'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

export interface CourseMedia {
  id: string
  storageKey: string
  provider: string
  durationSeconds: number | null
  fileName: string | null
  kind: 'video' | 'image' | 'document'
}

export interface LessonResource {
  id: string
  title: string | null
  media: CourseMedia
}

export interface CourseSummary {
  id: string
  title: string
  slug: string
  subtitle: string | null
  status: string
  level: string
  language: string
  certificateEnabled: boolean
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  thumbnail: CourseMedia | null
  category: { id: string; name: string; slug: string } | null
  createdBy: { id: string; fullName: string | null; avatar: { storageKey: string; provider: string } | null }
  _count: { enrollments: number; modules: number }
}

export interface CourseLesson {
  id: string
  title: string
  type: 'video' | 'reading'
  position: number
  videoDurationSeconds: number | null
  isPreview: boolean
  contentHtml: string | null
  video: CourseMedia | null
  resources: LessonResource[]
}

export interface CourseModuleTest {
  id: string
  title: string
  isRequired: boolean
  passingScore: number
  _count: { questions: number }
}

export interface CourseModule {
  id: string
  title: string
  description: string | null
  position: number
  lessons: CourseLesson[]
  test?: CourseModuleTest | null
}

export interface CourseDetail extends CourseSummary {
  description: string | null
  learningOutcomes: string[]
  requirements: string[]
  previewVideo: CourseMedia | null
  modules: CourseModule[]
}

export interface CourseEnrollment {
  id: string
  progressPercent: number
  status: string
  completedLessonIds: string[]
  passedTestIds: string[]
}

export interface CourseStats {
  moduleCount: number
  lectureCount: number
  videoCount: number
  articleCount: number
  totalDurationSeconds: number
  studentCount: number
}

export const levelLabels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
}

export function courseThumbUrl(m: CourseMedia | null): string | null {
  if (!m) return null
  if (m.provider === 'cloudinary' && CLOUD_NAME) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_640,h_360,f_auto,q_auto/${m.storageKey}`
  }
  if (m.provider === 'local') return `${API_ORIGIN}/uploads/${m.storageKey}`
  return null
}

/** Direct, in-browser URL for a video or PDF asset (renders inline, never a download). */
export function mediaUrl(m: CourseMedia | null): string | null {
  if (!m) return null
  if (m.provider === 'cloudinary' && CLOUD_NAME) {
    if (m.kind === 'video') return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${m.storageKey}.mp4`
    if (m.kind === 'document') return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${m.storageKey}.pdf`
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${m.storageKey}`
  }
  if (m.provider === 'local') return `${API_ORIGIN}/uploads/${m.storageKey}`
  return null
}

/** "62h 37m" style — for totals. */
export function formatTotalTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

/** "14:42" style — for a single lecture. */
export function formatLectureTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function moduleDuration(lessons: CourseLesson[]): number {
  return lessons.reduce((sum, l) => sum + (l.videoDurationSeconds ?? 0), 0)
}
