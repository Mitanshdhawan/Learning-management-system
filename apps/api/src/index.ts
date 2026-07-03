import { createApp } from './app'
import { env } from './env'

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
