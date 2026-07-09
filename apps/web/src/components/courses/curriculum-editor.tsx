'use client'

import { Eye, FileText, PlayCircle, Plus, Trash2, Upload, X } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MediaViewerModal } from '@/components/courses/media-viewer-modal'
import { Select } from '@/components/ui/select'
import { API_ORIGIN, apiDelete, apiPatch, apiPost, uploadMedia } from '@/lib/api'
import { type CourseDetail, type CourseMedia, formatLectureTime, mediaUrl } from '@/lib/courses'

// ----- Draft model: everything is edited locally and only persisted on commit() -----

interface DraftResource {
  id: string
  title: string | null
  media: CourseMedia
  isNew: boolean
}
interface DraftLesson {
  id: string
  isNew: boolean
  serverTitle: string
  title: string
  type: 'video' | 'reading'
  video: CourseMedia | null
  videoDurationSeconds: number | null
  videoDirty: boolean
  resources: DraftResource[]
  removedResourceIds: string[]
}
interface DraftModule {
  id: string
  isNew: boolean
  serverTitle: string
  title: string
  lessons: DraftLesson[]
}

export interface CurriculumHandle {
  hasChanges: () => boolean
  /** Reveal inline errors on lectures missing their file; returns true if every lecture has its asset. */
  validate: () => boolean
  /** Persist every pending change. Throws on failure. */
  commit: () => Promise<void>
}

function initModules(course: CourseDetail): DraftModule[] {
  return course.modules.map((m) => ({
    id: m.id,
    isNew: false,
    serverTitle: m.title,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      isNew: false,
      serverTitle: l.title,
      title: l.title,
      type: l.type,
      video: l.video,
      videoDurationSeconds: l.videoDurationSeconds,
      videoDirty: false,
      resources: l.resources.map((r) => ({ id: r.id, title: r.title, media: r.media, isNew: false })),
      removedResourceIds: [],
    })),
  }))
}

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

function mediaFromUpload(m: { id: string; provider: string; storageKey: string; durationSeconds: number | null }, kind: 'video' | 'document', fileName: string): CourseMedia {
  return { id: m.id, provider: m.provider, storageKey: m.storageKey, durationSeconds: m.durationSeconds, fileName, kind }
}

function LessonRow({
  lesson,
  isPreview,
  showValidation,
  onChange,
  onSetPreview,
  onRemove,
  registerUpload,
  discardMedia,
}: {
  lesson: DraftLesson
  isPreview: boolean
  showValidation: boolean
  onChange: (patch: Partial<DraftLesson>) => void
  onSetPreview: (id: string | null) => void
  onRemove: () => void
  registerUpload: (id: string) => void
  discardMedia: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; kind: 'video' | 'document'; title: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('video/')) return setError('Please choose a video file.')
    setError(null)
    setBusy(true)
    const previous = lesson.video
    try {
      const clientDuration = await readVideoDuration(file)
      const { media } = await uploadMedia<{ media: { id: string; provider: string; storageKey: string; durationSeconds: number | null } }>(file)
      onChange({
        video: mediaFromUpload(media, 'video', file.name),
        videoDurationSeconds: media.durationSeconds ?? clientDuration ?? null,
        videoDirty: true,
      })
      registerUpload(media.id)
      if (previous?.id) discardMedia(previous.id) // drop a staged video it replaces
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
    if (file.type !== 'application/pdf') return setError('Only PDFs can be read in the browser — please upload a PDF.')
    setError(null)
    setBusy(true)
    try {
      const { media } = await uploadMedia<{ media: { id: string; provider: string; storageKey: string; durationSeconds: number | null } }>(file)
      const resource: DraftResource = {
        id: `tmpres_${media.id}`,
        title: file.name,
        media: mediaFromUpload(media, 'document', file.name),
        isNew: true,
      }
      onChange({ resources: [...lesson.resources, resource] })
      registerUpload(media.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  function removeResource(r: DraftResource) {
    onChange({
      resources: lesson.resources.filter((x) => x.id !== r.id),
      removedResourceIds: r.isNew ? lesson.removedResourceIds : [...lesson.removedResourceIds, r.id],
    })
    discardMedia(r.media.id) // deletes it only if it was a staged (unsaved) upload
  }

  const isVideo = lesson.type === 'video'
  const videoUrl = mediaUrl(lesson.video)
  const showMissing = showValidation && (isVideo ? !lesson.video : lesson.resources.length === 0)

  return (
    <div className={`py-2 pl-10 pr-3 ${showMissing ? 'bg-red-500/[0.05]' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {isVideo ? (
          <PlayCircle size={15} className="shrink-0 text-muted" />
        ) : (
          <FileText size={15} className="shrink-0 text-muted" />
        )}
        <input
          value={lesson.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition hover:border-border focus:border-accent"
        />
        {isVideo && (
          <label
            className="flex items-center gap-1 text-xs text-muted"
            title="Only one video across the whole course can be the free preview"
          >
            <input
              type="radio"
              name="course-preview"
              checked={isPreview}
              onChange={() => onSetPreview(lesson.id)}
              onClick={() => isPreview && onSetPreview(null)}
              className="accent-accent"
            />
            Preview
          </label>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-muted transition hover:text-red-500"
          aria-label="Delete lecture"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Media area */}
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
                <span key={r.id} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
                  <FileText size={13} className="text-accent" />
                  <span className="max-w-[180px] truncate text-foreground">{r.title ?? r.media.fileName ?? 'Document'}</span>
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
                    onClick={() => removeResource(r)}
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
        {showMissing && (
          <span className="font-medium text-red-500">
            {isVideo ? '⚠ Upload a video for this lecture' : '⚠ Upload a PDF for this lecture'}
          </span>
        )}
      </div>

      {viewer && (
        <MediaViewerModal url={viewer.url} kind={viewer.kind} title={viewer.title} onClose={() => setViewer(null)} />
      )}
    </div>
  )
}

function AddLesson({ onAdd }: { onAdd: (title: string, type: 'video' | 'reading') => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'video' | 'reading'>('video')
  const [error, setError] = useState<string | null>(null)

  function add() {
    if (!title.trim()) return setError('Enter a lecture name.')
    onAdd(title.trim(), type)
    setTitle('')
    setError(null)
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
          className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2.5 py-1 text-sm text-accent transition hover:bg-accent/25"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function ModuleBlock({
  module,
  previewId,
  showValidation,
  onChange,
  onRemove,
  onRemoveLesson,
  onSetPreview,
  registerUpload,
  discardMedia,
}: {
  module: DraftModule
  previewId: string | null
  showValidation: boolean
  onChange: (patch: Partial<DraftModule>) => void
  onRemove: () => void
  onRemoveLesson: (lesson: DraftLesson) => void
  onSetPreview: (id: string | null) => void
  registerUpload: (id: string) => void
  discardMedia: (id: string) => void
}) {
  function updateLesson(lessonId: string, patch: Partial<DraftLesson>) {
    onChange({ lessons: module.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)) })
  }

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <input
          value={module.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold outline-none transition hover:border-border focus:border-accent"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-muted transition hover:text-red-500"
          aria-label="Delete section"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="divide-y divide-border">
        {module.lessons.map((l) => (
          <LessonRow
            key={l.id}
            lesson={l}
            isPreview={previewId === l.id}
            showValidation={showValidation}
            onChange={(patch) => updateLesson(l.id, patch)}
            onSetPreview={onSetPreview}
            onRemove={() => onRemoveLesson(l)}
            registerUpload={registerUpload}
            discardMedia={discardMedia}
          />
        ))}
        <AddLesson
          onAdd={(title, type) =>
            onChange({
              lessons: [
                ...module.lessons,
                {
                  id: `tmp_${title}_${module.lessons.length}_${Math.round(performance.now())}`,
                  isNew: true,
                  serverTitle: '',
                  title,
                  type,
                  video: null,
                  videoDurationSeconds: null,
                  videoDirty: false,
                  resources: [],
                  removedResourceIds: [],
                },
              ],
            })
          }
        />
      </div>
    </div>
  )
}

export const CurriculumEditor = forwardRef<
  CurriculumHandle,
  { course: CourseDetail; onDirtyChange?: (dirty: boolean) => void }
>(function CurriculumEditor({ course, onDirtyChange }, ref) {
  const [modules, setModules] = useState<DraftModule[]>(() => initModules(course))
  const [previewId, setPreviewId] = useState<string | null>(
    () => course.modules.flatMap((m) => m.lessons).find((l) => l.isPreview)?.id ?? null,
  )
  const removed = useRef<{ modules: string[]; lessons: string[] }>({ modules: [], lessons: [] })
  const serverPreviewId = useRef<string | null>(previewId)
  const pending = useRef<Set<string>>(new Set()) // media uploaded this session, not yet saved
  const orphanOnSave = useRef<Set<string>>(new Set()) // saved files a replace/remove will orphan once saved
  const committedRef = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [moduleTitle, setModuleTitle] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false) // reveal per-lecture "missing file" errors after a save attempt

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  const touch = () => setDirty(true)

  const registerUpload = (id: string) => pending.current.add(id)
  const discardMedia = (id: string) => {
    if (pending.current.has(id)) {
      pending.current.delete(id)
      apiDelete(`/media/${id}`).catch(() => {}) // an unsaved upload → safe to delete right away
    } else {
      orphanOnSave.current.add(id) // a saved file → delete only once a save actually orphans it
    }
  }

  // Delete staged-but-unsaved uploads when leaving without saving (SPA nav or full page unload).
  useEffect(() => {
    const flush = (viaBeacon: boolean) => {
      if (committedRef.current || pending.current.size === 0) return
      const ids = Array.from(pending.current)
      pending.current.clear()
      if (viaBeacon) {
        const token = localStorage.getItem('accessToken')
        ids.forEach((id) =>
          fetch(`${API_ORIGIN}/api/media/${id}`, {
            method: 'DELETE',
            keepalive: true,
            headers: token ? { authorization: `Bearer ${token}` } : {},
          }).catch(() => {}),
        )
      } else {
        ids.forEach((id) => apiDelete(`/media/${id}`).catch(() => {}))
      }
    }
    const onHide = () => flush(true)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      flush(false)
    }
  }, [])

  function updateModule(moduleId: string, patch: Partial<DraftModule>) {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)))
    touch()
  }

  function removeModule(m: DraftModule) {
    if (!window.confirm('Remove this section and its lectures?')) return
    if (!m.isNew) removed.current.modules.push(m.id)
    for (const l of m.lessons) {
      if (l.video) discardMedia(l.video.id)
      l.resources.forEach((r) => discardMedia(r.media.id))
    }
    if (previewId && m.lessons.some((l) => l.id === previewId)) setPreviewId(null)
    setModules((prev) => prev.filter((x) => x.id !== m.id))
    touch()
  }

  function removeLesson(moduleId: string, lesson: DraftLesson) {
    if (!lesson.isNew) removed.current.lessons.push(lesson.id)
    if (lesson.video) discardMedia(lesson.video.id)
    lesson.resources.forEach((r) => discardMedia(r.media.id))
    if (previewId === lesson.id) setPreviewId(null)
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) } : m)),
    )
    touch()
  }

  function addModule() {
    if (!moduleTitle.trim()) return setAddError('Enter a section name.')
    setModules((prev) => [
      ...prev,
      {
        id: `tmpmod_${prev.length}_${Math.round(performance.now())}`,
        isNew: true,
        serverTitle: '',
        title: moduleTitle.trim(),
        lessons: [],
      },
    ])
    setModuleTitle('')
    setAddError(null)
    touch()
  }

  function setPreview(id: string | null) {
    setPreviewId(id)
    touch()
  }

  const lessonMissingAsset = (l: DraftLesson) => (l.type === 'video' ? !l.video : l.resources.length === 0)

  const validate = () => {
    const hasMissing = modules.flatMap((m) => m.lessons).some(lessonMissingAsset)
    setShowValidation(hasMissing)
    return !hasMissing
  }

  useImperativeHandle(
    ref,
    () => ({
      hasChanges: () => dirty,
      validate,
      commit: async () => {
        // 1) Deletions first.
        for (const id of removed.current.modules) await apiDelete(`/modules/${id}`)
        for (const id of removed.current.lessons) await apiDelete(`/lessons/${id}`)

        // 2) Modules → lessons → media → resources. Track tmp → real ids for the preview.
        let previewRealId: string | null = null
        for (const m of modules) {
          let moduleId = m.id
          if (m.isNew) {
            const { module } = await apiPost<{ module: { id: string } }>(`/courses/${course.id}/modules`, {
              title: m.title.trim() || 'Untitled section',
            })
            moduleId = module.id
          } else if (m.title.trim() && m.title !== m.serverTitle) {
            await apiPatch(`/modules/${moduleId}`, { title: m.title.trim() })
          }

          for (const l of m.lessons) {
            let lessonId = l.id
            if (l.isNew) {
              const { lesson } = await apiPost<{ lesson: { id: string } }>(`/modules/${moduleId}/lessons`, {
                title: l.title.trim() || 'Untitled lecture',
                type: l.type,
              })
              lessonId = lesson.id
            } else if (l.title.trim() && l.title !== l.serverTitle) {
              await apiPatch(`/lessons/${lessonId}`, { title: l.title.trim() })
            }
            if (l.videoDirty && l.video) {
              await apiPatch(`/lessons/${lessonId}`, { videoId: l.video.id, videoDurationSeconds: l.videoDurationSeconds ?? null })
            }
            for (const rid of l.removedResourceIds) await apiDelete(`/resources/${rid}`)
            for (const r of l.resources) {
              if (r.isNew) await apiPost(`/lessons/${lessonId}/resources`, { mediaId: r.media.id, title: r.title })
            }
            if (l.id === previewId) previewRealId = lessonId
          }
        }

        // 3) Preview — set the chosen one (server clears the rest), or clear if none.
        if (previewRealId) {
          await apiPatch(`/lessons/${previewRealId}`, { isPreview: true })
        } else if (serverPreviewId.current && !removed.current.lessons.includes(serverPreviewId.current)) {
          await apiPatch(`/lessons/${serverPreviewId.current}`, { isPreview: false })
        }

        // Delete files this save has now orphaned — a replaced video, a removed PDF.
        // The server refuses if a file is somehow still referenced, so this can never over-delete.
        for (const id of orphanOnSave.current) {
          await apiDelete(`/media/${id}`).catch(() => {})
        }
        orphanOnSave.current.clear()

        // Everything staged is now attached — no orphans to clean up.
        committedRef.current = true
        pending.current.clear()
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modules, previewId, dirty, course.id],
  )

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Curriculum</h2>
        {dirty && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            Unsaved — click Save changes / Publish
          </span>
        )}
      </div>
      {modules.length > 0 && (
        <div className="space-y-3">
          {modules.map((m) => (
            <ModuleBlock
              key={m.id}
              module={m}
              previewId={previewId}
              showValidation={showValidation}
              onChange={(patch) => updateModule(m.id, patch)}
              onRemove={() => removeModule(m)}
              onRemoveLesson={(lesson) => removeLesson(m.id, lesson)}
              onSetPreview={setPreview}
              registerUpload={registerUpload}
              discardMedia={discardMedia}
            />
          ))}
        </div>
      )}
      <div>
        <div className="flex gap-2">
          <input
            value={moduleTitle}
            onChange={(e) => {
              setModuleTitle(e.target.value)
              if (addError) setAddError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && addModule()}
            placeholder="New section title"
            className={`flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-accent ${
              addError ? 'border-red-500/60' : 'border-border'
            }`}
          />
          <button
            type="button"
            onClick={addModule}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus size={15} /> Add section
          </button>
        </div>
        {addError && <p className="mt-1.5 text-sm text-red-500">{addError}</p>}
      </div>
    </div>
  )
})
