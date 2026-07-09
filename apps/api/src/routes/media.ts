import { prisma } from '@toplms/db'
import { Router } from 'express'
import { deleteStoredMedia, saveMedia, uploadMedia } from '../lib/uploads'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'

export const mediaRouter = Router()

// POST /api/media — upload an image or video, returns the created MediaAsset.
mediaRouter.post('/', requireAuth, uploadMedia.single('file'), async (req, res) => {
  const file = req.file
  if (!file) throw new HttpError(400, 'No file uploaded')

  const stored = await saveMedia(file, 'courses')
  const media = await prisma.mediaAsset.create({
    data: {
      kind: stored.kind,
      provider: stored.provider,
      storageKey: stored.storageKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: BigInt(file.size),
      width: stored.width,
      height: stored.height,
      durationSeconds: stored.durationSeconds,
      uploadedById: req.user!.id,
    },
  })

  res.status(201).json({
    media: {
      id: media.id,
      provider: media.provider,
      storageKey: media.storageKey,
      kind: media.kind,
      durationSeconds: media.durationSeconds,
      width: media.width,
      height: media.height,
    },
  })
})

// DELETE /api/media/:id — remove an uploaded file that isn't attached to anything yet.
// Used to clean up orphans: media uploaded in the course builder but never saved onto a course.
mediaRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id)
  const media = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      provider: true,
      storageKey: true,
      kind: true,
      uploadedById: true,
      _count: {
        select: {
          avatarUsers: true,
          courseThumbnails: true,
          coursePreviewVideos: true,
          lessonVideos: true,
          lessonResources: true,
          certificates: true,
        },
      },
    },
  })
  if (!media) throw new HttpError(404, 'Media not found')
  if (req.user!.role !== 'admin' && media.uploadedById !== req.user!.id) {
    throw new HttpError(403, 'You can only delete your own uploads')
  }
  // Never delete a file that's actually in use — this is the safety net for the cleanup logic.
  const refs = Object.values(media._count).reduce((a, b) => a + b, 0)
  if (refs > 0) throw new HttpError(409, 'Media is in use and cannot be deleted')

  await deleteStoredMedia(media)
  await prisma.mediaAsset.delete({ where: { id } })
  res.status(204).end()
})
