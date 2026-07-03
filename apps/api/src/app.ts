import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './env'
import { uploadsDir } from './lib/uploads'
import { errorHandler, notFound } from './middleware/error'
import { apiRouter } from './routes'

export function createApp() {
  const app = express()

  // cross-origin resource policy so the web app (:3000) can load images from the API (:4000)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: env.WEB_APP_URL, credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  app.use('/uploads', express.static(uploadsDir))
  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
