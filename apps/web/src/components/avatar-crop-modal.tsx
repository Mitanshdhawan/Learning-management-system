'use client'

import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Draw the selected region to a 256x256 square canvas and return a JPEG blob.
async function cropToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const size = 256
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not crop image'))), 'image/jpeg', 0.9)
  })
}

interface Props {
  file: File
  onCancel: () => void
  onCropped: (blob: Blob) => void
}

export function AvatarCropModal({ file, onCancel, onCropped }: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setImageSrc(reader.result as string)
    reader.readAsDataURL(file)
  }, [file])

  const onCropComplete = useCallback((_area: Area, pixels: Area) => setArea(pixels), [])

  async function save() {
    if (!imageSrc || !area) return
    setSaving(true)
    try {
      onCropped(await cropToBlob(imageSrc, area))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Position your photo</h2>
        <p className="mt-1 text-sm text-muted">Drag to move, use the slider to zoom.</p>

        <div className="relative mt-4 h-64 w-full overflow-hidden rounded-xl bg-background">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !area}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
