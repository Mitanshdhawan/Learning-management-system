import { Router } from 'express'
import { adminRouter } from './admin'
import { authRouter } from './auth'
import { healthRouter } from './health'
import { invitationsRouter } from './invitations'
import { usersRouter } from './users'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/invitations', invitationsRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/admin', adminRouter)
