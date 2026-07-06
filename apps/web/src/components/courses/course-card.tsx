'use client'

import Link from 'next/link'
import { BookOpen, Pencil, Users } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { type CourseSummary, courseThumbUrl, levelLabels } from '@/lib/courses'

export function CourseCard({ course, canEdit }: { course: CourseSummary; canEdit?: boolean }) {
  const thumb = courseThumbUrl(course.thumbnail)

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5">
      {/* Whole-card click target — sits above the content, below the action button. */}
      <Link href={`/dashboard/courses/${course.slug}`} aria-label={course.title} className="absolute inset-0 z-10" />

      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-accent/30 to-accent/5">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-accent/60">
            <BookOpen size={40} />
          </div>
        )}
        {course.status !== 'published' && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium capitalize text-white">
            {course.status}
          </span>
        )}
        {canEdit && (
          <Link
            href={`/dashboard/courses/${course.slug}/edit`}
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition duration-200 hover:bg-black/80"
          >
            <Pencil size={12} /> Edit
          </Link>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {course.category && <p className="text-xs font-medium text-accent">{course.category.name}</p>}
        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">{course.title}</h3>
        {course.subtitle && <p className="mt-1 line-clamp-2 text-sm text-muted">{course.subtitle}</p>}

        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Avatar
            user={{ fullName: course.createdBy.fullName, email: '', avatar: course.createdBy.avatar }}
            size={22}
          />
          <span className="truncate">{course.createdBy.fullName ?? 'Instructor'}</span>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs text-muted">
          <span className="rounded-full border border-border px-2 py-0.5 capitalize">
            {levelLabels[course.level] ?? course.level}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen size={13} /> {course._count.modules} sections
          </span>
          <span className="flex items-center gap-1">
            <Users size={13} /> {course._count.enrollments}
          </span>
        </div>
      </div>
    </div>
  )
}
