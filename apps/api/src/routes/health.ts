import { prisma } from '@toplms/db'
import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  let db: 'ok' | 'down' = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = 'down'
  }

  res.json({ status: 'ok', db, time: new Date().toISOString() })
})
