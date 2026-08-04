'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { CategoryPicker } from '@/components/ui/category-picker'
import { Select } from '@/components/ui/select'
import { apiGet, apiPost } from '@/lib/api'

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'All levels' },
]

export default function NewCoursePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [level, setLevel] = useState('all_levels')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiGet<{ categories: { id: string; name: string }[] }>('/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {})
  }, [])

  const canCreate =
    user?.role === 'admin' || Boolean(user?.canCreateCourses) || Boolean(user?.canManageAllCourses)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const payload: { title: string; level: string; subtitle?: string; categoryId?: string } = { title, level }
      if (subtitle) payload.subtitle = subtitle
      if (categoryId) payload.categoryId = categoryId
      const { course } = await apiPost<{ course: { slug: string } }>('/courses', payload)
      router.push(`/dashboard/courses/${course.slug}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create course')
      setBusy(false)
    }
  }

  if (!canCreate) {
    return <p className="text-sm text-muted">You don&apos;t have permission to create courses.</p>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/dashboard/courses"
        className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
      >
        <ChevronLeft size={16} /> All courses
      </Link>
      <h1 className="text-2xl font-bold">Create a course</h1>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div>
          <label className="mb-1 block text-sm font-medium">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Complete Generative AI Course"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Subtitle</label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="A short tagline"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-accent"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <CategoryPicker
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              allowCreate={user?.role === 'admin'}
              onCategoryCreated={(c) =>
                setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Level</label>
            <Select value={level} onChange={setLevel} options={LEVELS} />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create & continue'}
        </button>
      </form>
    </div>
  )
}
