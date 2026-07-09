'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Eye, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { CourseDetailsForm, type CourseDetailsFormHandle } from '@/components/courses/course-details-form'
import { CurriculumEditor, type CurriculumHandle } from '@/components/courses/curriculum-editor'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import { apiDelete, apiGet, apiPatch } from '@/lib/api'
import { type CourseDetail } from '@/lib/courses'

export default function CourseBuilderPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [curriculumDirty, setCurriculumDirty] = useState(false)
  const [curriculumVersion, setCurriculumVersion] = useState(0)
  const formRef = useRef<CourseDetailsFormHandle>(null)
  const curriculumRef = useRef<CurriculumHandle>(null)

  const load = useCallback(async () => {
    const { course } = await apiGet<{ course: CourseDetail }>(`/courses/${params.slug}`)
    setCourse(course)
    return course
  }, [params.slug])

  useEffect(() => {
    load()
      .then((c) => {
        if (user && user.role !== 'admin' && c.createdBy.id !== user.id) setDenied(true)
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false))
    apiGet<{ categories: { id: string; name: string }[] }>('/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {})
  }, [load, user])

  // Warn before leaving with unsaved curriculum changes.
  useEffect(() => {
    if (!curriculumDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [curriculumDirty])

  if (loading) return <p className="text-sm text-muted">Loading…</p>

  if (denied || !course) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <p className="font-semibold">You can&apos;t edit this course.</p>
        <Link href="/dashboard/courses" className="mt-3 inline-block text-sm text-accent">
          ← Back to courses
        </Link>
      </div>
    )
  }

  const isPublished = course.status === 'published'
  const canCreateCategory = user?.role === 'admin'

  // The single primary action: persist the details form AND every pending curriculum change,
  // then (for a draft with all media in place) publish.
  async function saveDetails(publish: boolean) {
    setPublishError(null)
    // Every video/reading lecture must have its file uploaded before anything is saved.
    const valid = curriculumRef.current?.validate() ?? true
    if (!valid) {
      setPublishError('Some lectures still need their video or PDF — upload the highlighted ones, then save.')
      return
    }
    setSaving(true)
    try {
      await formRef.current?.save()
      await curriculumRef.current?.commit()
      if (publish) await apiPatch(`/courses/${course!.id}`, { status: 'published' })
      await load()
      setCurriculumVersion((v) => v + 1) // remount the editor → reset the draft from fresh data
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Could not save your changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function unpublish() {
    setSaving(true)
    try {
      await apiPatch(`/courses/${course!.id}`, { status: 'draft' })
      await load()
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/courses"
        className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
      >
        <ChevronLeft size={16} /> All courses
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {isPublished ? 'This course is live. Save changes to update it.' : 'Fill in the details, then publish when it’s ready.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedFlash && <span className="text-xs font-medium text-emerald-500">Saved ✓</span>}
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
              isPublished ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500' : 'border-border text-muted'
            }`}
          >
            {course.status}
          </span>
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            disabled={saving}
            aria-label="Delete course"
            className="rounded-lg border border-border p-2 text-muted transition hover:border-red-500/50 hover:text-red-500 disabled:opacity-60"
          >
            <Trash2 size={16} />
          </button>
          <Link
            href={`/dashboard/courses/${course.slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-accent/60"
          >
            <Eye size={15} /> View
          </Link>
          {isPublished && (
            <button
              type="button"
              onClick={unpublish}
              disabled={saving}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-accent/60 hover:text-foreground disabled:opacity-60"
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            onClick={() => saveDetails(!isPublished)}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isPublished ? 'Save changes' : 'Publish'}
          </button>
        </div>
      </div>

      {publishError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {publishError}
        </div>
      )}

      <CourseDetailsForm
        ref={formRef}
        course={course}
        categories={categories}
        allowCreateCategory={canCreateCategory}
        onCategoryCreated={(c) =>
          setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
        }
        onSaved={load}
      />
      <CurriculumEditor
        key={curriculumVersion}
        ref={curriculumRef}
        course={course}
        onDirtyChange={setCurriculumDirty}
      />

      {showDelete && (
        <ConfirmDeleteModal
          title="Delete this course?"
          confirmText={course.title}
          confirmHint="Course name"
          description={
            <>
              This permanently deletes{' '}
              <span className="font-medium text-foreground">{course.title}</span> and all its sections,
              lectures, and enrolments. This cannot be undone.
            </>
          }
          confirmLabel="Delete course"
          onCancel={() => setShowDelete(false)}
          onConfirm={async () => {
            await apiDelete(`/courses/${course!.id}`)
            router.push('/dashboard/courses')
          }}
        />
      )}
    </div>
  )
}
