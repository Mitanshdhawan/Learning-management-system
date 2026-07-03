import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { v2 as cloudinary } from 'cloudinary'
import multer from 'multer'

// Local temp/disk storage. When Cloudinary is configured we upload there and
// remove the local copy; otherwise the local file is served from /uploads.
export const uploadsDir = join(process.cwd(), 'uploads')
mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname) || '.jpg'}`),
})

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

export interface StoredImage {
  provider: string
  storageKey: string
  width?: number
  height?: number
}

function cloudinaryCreds() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME
  const api_key = process.env.CLOUDINARY_API_KEY
  const api_secret = process.env.CLOUDINARY_API_SECRET
  if (cloud_name && api_key && api_secret) return { cloud_name, api_key, api_secret }
  return null
}

// Uploads to Cloudinary when creds are present; otherwise keeps the local file.
export async function saveImage(file: Express.Multer.File, folder: string): Promise<StoredImage> {
  const creds = cloudinaryCreds()
  if (creds) {
    cloudinary.config(creds)
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `toplms/${folder}`,
      resource_type: 'image',
    })
    await unlink(file.path).catch(() => {})
    return {
      provider: 'cloudinary',
      storageKey: result.public_id,
      width: result.width,
      height: result.height,
    }
  }
  return { provider: 'local', storageKey: file.filename }
}
