import type { NextFunction, Request, Response } from 'express'

/** Throw this from any handler to return a specific status + message (+ optional code). */
export class HttpError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'HttpError'
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })
    return
  }

  // Multer rejects oversized or wrong-type uploads with its own error class.
  // Surface something the client can actually show instead of a blank 500.
  const code = (err as { code?: string })?.code
  if (code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'That file is too large — the limit is 200 MB' })
    return
  }
  if (typeof code === 'string' && code.startsWith('LIMIT_')) {
    res.status(400).json({ error: (err as Error).message || 'Upload rejected' })
    return
  }
  // A file-type rejection from the multer fileFilter — a real client error, not ours.
  if (err instanceof Error && err.message === 'Only images, videos, or PDF files are allowed') {
    res.status(415).json({ error: err.message })
    return
  }

  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
