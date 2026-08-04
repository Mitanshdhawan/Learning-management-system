import { prisma } from '@toplms/db'
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'

export const testAttemptsRouter = Router()

const recordingSelect = {
  id: true,
  storageKey: true,
  provider: true,
  kind: true,
  durationSeconds: true,
  fileName: true,
} as const

/**
 * GET /api/test-attempts/:id — the full breakdown of one attempt: every question,
 * what the learner picked, what was correct, the grade and the proctoring footage.
 * Reviewer-only: an admin, or the learner's own manager. Learners never see this.
 */
testAttemptsRouter.get('/:id', requireAuth, async (req, res) => {
  const me = req.user!
  const id = String(req.params.id)

  const attempt = await prisma.testAttempt.findUnique({
    where: { id },
    select: {
      id: true,
      attemptNumber: true,
      score: true,
      passed: true,
      startedAt: true,
      submittedAt: true,
      screenRecording: { select: recordingSelect },
      cameraRecording: { select: recordingSelect },
      enrollment: {
        select: {
          user: { select: { id: true, fullName: true, email: true, managerId: true } },
          course: { select: { title: true, slug: true } },
        },
      },
      test: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          module: { select: { title: true } },
          questions: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              questionText: true,
              type: true,
              points: true,
              options: {
                orderBy: { position: 'asc' },
                select: { id: true, optionText: true, isCorrect: true },
              },
            },
          },
        },
      },
      answers: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          questionId: true,
          questionSnapshot: true,
          selectedOptionIds: true,
          isCorrect: true,
          pointsAwarded: true,
        },
      },
    },
  })
  if (!attempt) throw new HttpError(404, 'Attempt not found')

  const learner = attempt.enrollment.user
  const allowed = me.role === 'admin' || (me.role === 'manager' && learner.managerId === me.id)
  if (!allowed) throw new HttpError(403, 'You can only review your own team members')

  interface Snapshot {
    position?: number
    questionText: string
    type: string
    points: number
    options: { id: string; optionText: string; isCorrect: boolean }[]
  }

  // Render from the answer's own snapshot — the test may have been edited since.
  // Attempts recorded before snapshots existed fall back to the live question.
  const liveBy = new Map(attempt.test.questions.map((q) => [q.id, q]))
  const livePosition = new Map(attempt.test.questions.map((q, i) => [q.id, i]))
  const questions = attempt.answers
    .map((a, i) => {
      const snap = (a.questionSnapshot ?? null) as Snapshot | null
      const live = a.questionId ? liveBy.get(a.questionId) : undefined
      const source = snap ?? live
      const selected = Array.isArray(a.selectedOptionIds) ? (a.selectedOptionIds as string[]) : []
      return {
        // Original order first, then the live test's order, then insertion order.
        position: snap?.position ?? (a.questionId ? livePosition.get(a.questionId) : undefined) ?? i,
        id: a.id,
        questionText: source?.questionText ?? `Question ${i + 1} (removed from the test)`,
        type: source?.type ?? 'single_choice',
        points: source?.points ?? a.pointsAwarded,
        isCorrect: a.isCorrect ?? false,
        pointsAwarded: a.pointsAwarded,
        selectedOptionIds: selected,
        options: source?.options ?? [],
      }
    })
    .sort((x, y) => x.position - y.position)

  res.json({
    attempt: {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    },
    learner: { id: learner.id, fullName: learner.fullName, email: learner.email },
    course: attempt.enrollment.course,
    test: {
      id: attempt.test.id,
      title: attempt.test.title,
      passingScore: attempt.test.passingScore,
      sectionTitle: attempt.test.module.title,
    },
    questions,
    totalPoints: questions.reduce((s, q) => s + q.points, 0),
    earnedPoints: questions.reduce((s, q) => s + q.pointsAwarded, 0),
    recordings: { screen: attempt.screenRecording, camera: attempt.cameraRecording },
  })
})
