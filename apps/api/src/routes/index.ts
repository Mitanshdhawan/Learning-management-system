import { Router } from 'express'
import { authRouter } from './auth'
import { healthRouter } from './health'
import { invitationsRouter } from './invitations'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/invitations', invitationsRouter)
