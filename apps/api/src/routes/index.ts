import { Router } from 'express'
import { adminRouter } from './admin'
import { authRouter } from './auth'
import { categoriesRouter } from './categories'
import { coursesRouter } from './courses'
import { enrollmentsRouter } from './enrollments'
import { healthRouter } from './health'
import { invitationsRouter } from './invitations'
import { lessonsRouter } from './lessons'
import { mediaRouter } from './media'
import { modulesRouter } from './modules'
import { resourcesRouter } from './resources'
import { teamRouter } from './team'
import { testAttemptsRouter } from './test-attempts'
import { usersRouter } from './users'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/invitations', invitationsRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/team', teamRouter)
apiRouter.use('/test-attempts', testAttemptsRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/categories', categoriesRouter)
apiRouter.use('/courses', coursesRouter)
apiRouter.use('/enrollments', enrollmentsRouter)
apiRouter.use('/modules', modulesRouter)
apiRouter.use('/lessons', lessonsRouter)
apiRouter.use('/resources', resourcesRouter)
apiRouter.use('/media', mediaRouter)
