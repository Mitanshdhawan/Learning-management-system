import { prisma } from '@toplms/db'
import { Router } from 'express'
import { saveMedia, uploadMedia } from '../lib/uploads'
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
