import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './env'
import { errorHandler, notFound } from './middleware/error'
import { apiRouter } from './routes'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.WEB_APP_URL, credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
