'use client'

import { Eye, FileText, PlayCircle, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Select } from '@/components/ui/select'
import { apiDelete, apiPatch, apiPost, uploadMedia } from '@/lib/api'
import {
  type CourseDetail,
  type CourseLesson,
  type CourseModule,
  formatLectureTime,
  mediaUrl,
} from '@/lib/courses'

/** Read a video file's duration (seconds) in the browser, before upload. */
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null)
      }
      v.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      v.src = url
    } catch {
      resolve(null)
    }
  })
}

/** In-app viewer — plays a video or renders a PDF inside a modal (never a new tab). */
function MediaViewerModal({
  url,
  kind,
  title,
  onClose,
}: {
  url: string
  kind: 'video' | 'document'
  title: string
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="truncate text-sm font-medium">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="rounded-lg p-1.5 text-muted transition hover:bg-background hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {kind === 'video' ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={url} controls autoPlay className="max-h-[78vh] w-full bg-black" />
          ) : (
            <iframe src={url} title={title} className="h-[78vh] w-full bg-white" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function LessonRow({ lesson, onRefresh }: { lesson: CourseLesson; onRefresh: () => void }) {
  const [title, setTitle] = useState(lesson.title)
  const [preview, setPreview] = useState(lesson.isPreview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; kind: 'video' | 'document'; title: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function patch(data: Record<string, unknown>) {
    try {
      await apiPatch(`/lessons/${lesson.id}`, data)
    } catch {
      /* ignore */
    }
  }

  async function onVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Please choose a video file.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const clientDuration = await readVideoDuration(file)
      const { media } = await uploadMedia<{ media: { id: string; durationSeconds: number | null } }>(file)
      await apiPatch(`/lessons/${lesson.id}`, {
        videoId: media.id,
        videoDurationSeconds: media.durationSeconds ?? clientDuration ?? null,
      })
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function onPdfPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Only PDFs can be read in the browser — please upload a PDF.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const { media } = await uploadMedia<{ media: { id: string } }>(file)
      await apiPost(`/lessons/${lesson.id}/resources`, { mediaId: media.id, title: file.name })
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function removeResource(resourceId: string) {
    await apiDelete(`/resources/${resourceId}`)
    onRefresh()
  }

  const isVideo = lesson.type === 'video'
  const videoUrl = mediaUrl(lesson.video)

  return (
    <div className="py-2 pl-10 pr-3">
      <div className="flex flex-wrap items-center gap-2">
        {isVideo ? (
          <PlayCircle size={15} className="shrink-0 text-muted" />
        ) : (
          <FileText size={15} className="shrink-0 text-muted" />
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== lesson.title && patch({ title: title.trim() })}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-border focus:border-accent"
        />
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => {
              setPreview(e.target.checked)
              patch({ isPreview: e.target.checked })
            }}
            className="accent-accent"
          />
          Preview
        </label>
        <button
          type="button"
          onClick={async () => {
            await apiDelete(`/lessons/${lesson.id}`)
            onRefresh()
          }}
          className="text-muted transition hover:text-red-500"
          aria-label="Delete lecture"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Media area — upload the actual video (auto-duration) or an inline-viewable PDF */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6 text-xs">
        {isVideo ? (
          <>
            <input type="file" accept="video/*" ref={fileRef} onChange={onVideoPick} className="hidden" />
            {lesson.video ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
                  <PlayCircle size={13} className="text-accent" />
                  <span className="max-w-[180px] truncate text-foreground">{lesson.video.fileName ?? 'Video'}</span>
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 font-medium text-accent">
                    {lesson.videoDurationSeconds != null ? formatLectureTime(lesson.videoDurationSeconds) : '—'}
                  </span>
                </span>
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setViewer({ url: videoUrl, kind: 'video', title: lesson.video?.fileName ?? 'Video' })}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted transition hover:border-accent/60 hover:text-foreground"
                  >
                    <Eye size={13} /> View
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted transition hover:border-accent/60 hover:text-foreground disabled:opacity-60"
                >
                  <Upload size={13} /> {busy ? 'Uploading…' : 'Replace'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-2.5 py-1 font-medium text-accent transition hover:bg-accent/25 disabled:opacity-60"
              >
                <Upload size={13} /> {busy ? 'Uploading…' : 'Upload video'}
              </button>
            )}
          </>
        ) : (
          <>
            <input type="file" accept="application/pdf" ref={fileRef} onChange={onPdfPick} className="hidden" />
            {lesson.resources.map((r) => {
              const url = mediaUrl(r.media)
              return (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1"
                >
                  <FileText size={13} className="text-accent" />
                  <span className="max-w-[180px] truncate text-foreground">
                    {r.title ?? r.media.fileName ?? 'Document'}
                  </span>
                  {url && (
                    <button
                      type="button"
                      onClick={() => setViewer({ url, kind: 'document', title: r.title ?? 'Document' })}
                      className="inline-flex items-center gap-0.5 text-muted transition hover:text-accent"
                    >
                      <Eye size={13} /> View
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeResource(r.id)}
                    className="text-muted transition hover:text-red-500"
                    aria-label="Remove file"
                  >
                    <X size={13} />
                  </button>
                </span>
              )
            })}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-2.5 py-1 font-medium text-accent transition hover:bg-accent/25 disabled:opacity-60"
            >
              <Upload size={13} /> {busy ? 'Uploading…' : lesson.resources.length ? 'Add PDF' : 'Upload reading (PDF)'}
            </button>
          </>
        )}
        {error && <span className="text-red-500">{error}</span>}
      </div>

      {viewer && (
        <MediaViewerModal url={viewer.url} kind={viewer.kind} title={viewer.title} onClose={() => setViewer(null)} />
      )}
    </div>
  )
}

function AddLesson({ moduleId, onRefresh }: { moduleId: string; onRefresh: () => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'video' | 'reading'>('video')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!title.trim()) {
      setError('Enter a lecture name.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await apiPost(`/modules/${moduleId}/lessons`, { title: title.trim(), type })
      setTitle('')
      onRefresh()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-2 pl-10 pr-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={type}
          onChange={(v) => setType(v as 'video' | 'reading')}
          className="w-32"
          options={[
            { value: 'video', label: 'Video' },
            { value: 'reading', label: 'Reading' },
          ]}
        />
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New lecture title"
          className={`min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:border-accent ${
            error ? 'border-red-500/60' : 'border-border'
          }`}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2.5 py-1 text-sm text-accent transition hover:bg-accent/25 disabled:opacity-60"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function ModuleBlock({ module, onRefresh }: { module: CourseModule; onRefresh: () => void }) {
  const [title, setTitle] = useState(module.title)

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={async () => {
            if (title.trim() && title !== module.title) {
              try {
                await apiPatch(`/modules/${module.id}`, { title: title.trim() })
              } catch {
                /* ignore */
              }
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold outline-none transition hover:border-border focus:border-accent"
        />
        <button
          type="button"
          onClick={async () => {
            if (window.confirm('Delete this section and its lectures?')) {
              await apiDelete(`/modules/${module.id}`)
              onRefresh()
            }
          }}
          className="text-muted transition hover:text-red-500"
          aria-label="Delete section"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="divide-y divide-border">
        {module.lessons.map((l) => (
          <LessonRow key={l.id} lesson={l} onRefresh={onRefresh} />
        ))}
        <AddLesson moduleId={module.id} onRefresh={onRefresh} />
      </div>
    </div>
  )
}

export function CurriculumEditor({ course, onRefresh }: { course: CourseDetail; onRefresh: () => void }) {
  const [moduleTitle, setModuleTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addModule() {
    if (!moduleTitle.trim()) {
      setError('Enter a section name.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await apiPost(`/courses/${course.id}/modules`, { title: moduleTitle.trim() })
      setModuleTitle('')
      onRefresh()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-semibold">Curriculum</h2>
      {course.modules.length > 0 && (
        <div className="space-y-3">
          {course.modules.map((m) => (
            <ModuleBlock key={m.id} module={m} onRefresh={onRefresh} />
          ))}
        </div>
      )}
      <div>
        <div className="flex gap-2">
          <input
            value={moduleTitle}
            onChange={(e) => {
              setModuleTitle(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && addModule()}
            placeholder="New section title"
            className={`flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-accent ${
              error ? 'border-red-500/60' : 'border-border'
            }`}
          />
          <button
            type="button"
            onClick={addModule}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Plus size={15} /> Add section
          </button>
        </div>
        {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}
