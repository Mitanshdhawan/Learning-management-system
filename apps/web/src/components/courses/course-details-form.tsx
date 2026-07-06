'use client'

import { Upload } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { CategoryPicker, type Category } from '@/components/ui/category-picker'
import { Select } from '@/components/ui/select'
import { apiPatch, uploadMedia } from '@/lib/api'
import { type CourseDetail, courseThumbUrl } from '@/lib/courses'

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'All levels' },
]

export interface CourseDetailsFormHandle {
  /** Persist the current form values. Throws (and shows an inline error) on failure. */
  save: () => Promise<void>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={it}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="rounded-lg border border-border px-3 text-muted transition hover:border-red-500/50 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="text-sm text-accent transition hover:underline"
        >
          + Add {label.toLowerCase()}
        </button>
      </div>
    </div>
  )
}

interface Props {
  course: CourseDetail
  categories: Category[]
  allowCreateCategory?: boolean
  onCategoryCreated: (category: Category) => void
  onSaved: () => void
}

export const CourseDetailsForm = forwardRef<CourseDetailsFormHandle, Props>(function CourseDetailsForm(
  { course, categories, allowCreateCategory, onCategoryCreated, onSaved },
  ref,
) {
  const [title, setTitle] = useState(course.title)
  const [subtitle, setSubtitle] = useState(course.subtitle ?? '')
  const [categoryId, setCategoryId] = useState(course.category?.id ?? '')
  const [level, setLevel] = useState(course.level)
  const [description, setDescription] = useState(course.description ?? '')
  const [outcomes, setOutcomes] = useState<string[]>(course.learningOutcomes)
  const [requirements, setRequirements] = useState<string[]>(course.requirements)
  const [certificate, setCertificate] = useState(course.certificateEnabled)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const thumb = courseThumbUrl(course.thumbnail)

  useImperativeHandle(
    ref,
    () => ({
      save: async () => {
        setError(null)
        try {
          await apiPatch(`/courses/${course.id}`, {
            title,
            subtitle,
            categoryId: categoryId || null,
            level,
            description,
            learningOutcomes: outcomes.map((s) => s.trim()).filter(Boolean),
            requirements: requirements.map((s) => s.trim()).filter(Boolean),
            certificateEnabled: certificate,
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save')
          throw err
        }
      },
    }),
    [course.id, title, subtitle, categoryId, level, description, outcomes, requirements, certificate],
  )

  async function onThumb(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const { media } = await uploadMedia<{ media: { id: string } }>(file)
      await apiPatch(`/courses/${course.id}`, { thumbnailId: media.id })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-semibold">Course details</h2>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-4">
        <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-gradient-to-br from-accent/30 to-accent/5">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <input type="file" accept="image/*" ref={fileRef} onChange={onThumb} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:border-accent/60 disabled:opacity-60"
          >
            <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload thumbnail'}
          </button>
          <p className="mt-1 text-xs text-muted">A 16:9 image works best.</p>
        </div>
      </div>

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-accent"
        />
      </Field>
      <Field label="Subtitle">
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-accent"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <CategoryPicker
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            allowCreate={allowCreateCategory}
            onCategoryCreated={onCategoryCreated}
          />
        </Field>
        <Field label="Level">
          <Select value={level} onChange={setLevel} options={LEVELS} />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
        />
      </Field>
      <ListEditor label="What you'll learn" items={outcomes} onChange={setOutcomes} placeholder="Learning outcome" />
      <ListEditor label="Requirements" items={requirements} onChange={setRequirements} placeholder="Requirement" />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={certificate}
          onChange={(e) => setCertificate(e.target.checked)}
          className="accent-accent"
        />
        Offer a certificate of completion
      </label>
    </div>
  )
})
