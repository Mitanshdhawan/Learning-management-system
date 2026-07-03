import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { HttpError } from './error'

/** Validates & narrows req.body against a Zod schema; 400s on failure. */
export function validateBody<S extends z.ZodTypeAny>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const details = JSON.stringify(result.error.flatten().fieldErrors)
      throw new HttpError(400, `Validation failed: ${details}`)
    }
    req.body = result.data
    next()
  }
}
