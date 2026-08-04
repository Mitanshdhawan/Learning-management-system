import { prisma } from '@toplms/db'
import {
  lessonCreateSchema,
  moduleUpdateSchema,
  testSubmitSchema,
  testUpsertSchema,
} from '@toplms/validation'
import { Router } from 'express'
import {
  assertCanEditCourse,
  attemptLimitFor,
  recomputeEnrollmentProgress,
  testEditSelect,
  testTakeSelect,
} from '../lib/courses'
import { requireAuth } from '../middleware/auth'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validate'

export const modulesRouter = Router()

async function moduleCourseId(id: string): Promise<string> {
  const m = await prisma.module.findUnique({ where: { id }, select: { courseId: true } })
  if (!m) throw new HttpError(404, 'Module not found')
  return m.courseId
}

// PATCH /api/modules/:id — rename / re-describe / reorder.
modulesRouter.patch('/:id', requireAuth, validateBody(moduleUpdateSchema), async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(id), req.user!)
  const module = await prisma.module.update({ where: { id }, data: req.body })
  res.json({ module })
})

// DELETE /api/modules/:id
modulesRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(id), req.user!)
  await prisma.module.delete({ where: { id } })
  res.status(204).end()
})

// POST /api/modules/:id/lessons — add a lesson (position auto-appended).
modulesRouter.post('/:id/lessons', requireAuth, validateBody(lessonCreateSchema), async (req, res) => {
  const moduleId = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(moduleId), req.user!)

  const last = await prisma.lesson.findFirst({
    where: { moduleId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const lesson = await prisma.lesson.create({
    data: { moduleId, position: (last?.position ?? -1) + 1, ...req.body },
  })
  res.status(201).json({ lesson })
})

// ============================================================
//  Section test / assessment (one optional test per module)
// ============================================================

// GET /api/modules/:id/test — the section's test with correct answers (creator/editor view).
modulesRouter.get('/:id/test', requireAuth, async (req, res) => {
  const moduleId = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(moduleId), req.user!)
  const test = await prisma.test.findUnique({ where: { moduleId }, select: testEditSelect })
  res.json({ test })
})

// PUT /api/modules/:id/test — create or replace the section's test.
modulesRouter.put('/:id/test', requireAuth, validateBody(testUpsertSchema), async (req, res) => {
  const moduleId = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(moduleId), req.user!)
  const { title, isRequired, passingScore, maxAttempts, questions } = req.body as {
    title: string
    isRequired: boolean
    passingScore: number
    maxAttempts?: number | null
    questions: {
      type: 'single_choice' | 'multiple_choice' | 'true_false'
      questionText: string
      points: number
      options: { text: string; isCorrect: boolean }[]
    }[]
  }

  // Semantic validation the schema can't express on its own.
  questions.forEach((q, i) => {
    const opts = q.options ?? []
    if (opts.length < 2) throw new HttpError(400, `Question ${i + 1}: add at least 2 options`)
    const correct = opts.filter((o) => o.isCorrect).length
    if (correct < 1) throw new HttpError(400, `Question ${i + 1}: mark the correct answer`)
    if ((q.type === 'single_choice' || q.type === 'true_false') && correct !== 1)
      throw new HttpError(400, `Question ${i + 1}: pick exactly one correct answer`)
  })

  // Build the whole question tree once so Prisma creates it in a single nested write.
  const questionCreate = questions.map((q, i) => ({
    questionText: q.questionText,
    type: q.type,
    points: q.points,
    position: i,
    options: {
      create: q.options.map((o, j) => ({ optionText: o.text, isCorrect: o.isCorrect, position: j })),
    },
  }))

  const test = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.test.findUnique({ where: { moduleId }, select: { id: true } })
      let testId: string
      if (existing) {
        testId = existing.id
        // Past answers survive the rewrite: their questionId goes null and the
        // snapshot stored on each answer keeps the reviewer's record intact.
        await tx.question.deleteMany({ where: { testId } })
        await tx.test.update({
          where: { id: testId },
          data: {
            title,
            isRequired,
            passingScore,
            maxAttempts: maxAttempts ?? null,
            questions: { create: questionCreate },
          },
        })
      } else {
        const created = await tx.test.create({
          data: {
            moduleId,
            title,
            isRequired,
            passingScore,
            maxAttempts: maxAttempts ?? null,
            questions: { create: questionCreate },
          },
          select: { id: true },
        })
        testId = created.id
      }
      return tx.test.findUnique({ where: { id: testId }, select: testEditSelect })
    },
    { timeout: 20000 },
  )

  res.json({ test })
})

// DELETE /api/modules/:id/test — remove the section's test.
modulesRouter.delete('/:id/test', requireAuth, async (req, res) => {
  const moduleId = String(req.params.id)
  await assertCanEditCourse(await moduleCourseId(moduleId), req.user!)
  await prisma.test.deleteMany({ where: { moduleId } })
  res.status(204).end()
})

// GET /api/modules/:id/test/take — the section test for an enrolled learner (no correct answers).
modulesRouter.get('/:id/test/take', requireAuth, async (req, res) => {
  const moduleId = String(req.params.id)
  const courseId = await moduleCourseId(moduleId)
  const enrolled = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
    select: { id: true },
  })
  if (!enrolled && req.user!.role !== 'admin') {
    throw new HttpError(403, 'You are not enrolled in this course')
  }
  const test = await prisma.test.findUnique({ where: { moduleId }, select: testTakeSelect })
  if (!test) throw new HttpError(404, 'This section has no test')

  const attemptLimit = await attemptLimitFor(test.id, req.user!.id, test.maxAttempts)
  const attemptsUsed = enrolled
    ? await prisma.testAttempt.count({ where: { testId: test.id, enrollmentId: enrolled.id } })
    : 0
  const attemptsLeft = attemptLimit === null ? null : Math.max(0, attemptLimit - attemptsUsed)
  if (attemptsLeft === 0) throw new HttpError(403, 'You have used all your attempts for this test')

  res.json({ test, attemptsUsed, attemptLimit, attemptsLeft })
})

// GET /api/modules/:id/test/attempts — the learner's own attempt history (results only).
modulesRouter.get('/:id/test/attempts', requireAuth, async (req, res) => {
  const moduleId = String(req.params.id)
  const courseId = await moduleCourseId(moduleId)
  const test = await prisma.test.findUnique({
    where: { moduleId },
    select: { id: true, passingScore: true, maxAttempts: true },
  })
  if (!test) throw new HttpError(404, 'This section has no test')

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
    select: { id: true },
  })
  const attemptLimit = await attemptLimitFor(test.id, req.user!.id, test.maxAttempts)
  if (!enrollment) {
    res.json({
      attempts: [],
      bestScore: null,
      passed: false,
      passingScore: test.passingScore,
      attemptLimit,
      attemptsLeft: attemptLimit,
    })
    return
  }

  const attempts = await prisma.testAttempt.findMany({
    where: { testId: test.id, enrollmentId: enrollment.id },
    orderBy: { attemptNumber: 'asc' },
    select: { id: true, attemptNumber: true, score: true, passed: true, submittedAt: true },
  })
  const bestScore = attempts.length ? attempts.reduce((m, a) => Math.max(m, a.score ?? 0), 0) : null

  res.json({
    attempts,
    bestScore,
    passed: bestScore !== null && bestScore >= test.passingScore,
    passingScore: test.passingScore,
    attemptLimit,
    attemptsLeft: attemptLimit === null ? null : Math.max(0, attemptLimit - attempts.length),
  })
})

// POST /api/modules/:id/test/attempt — submit answers, auto-grade, store the attempt.
modulesRouter.post('/:id/test/attempt', requireAuth, validateBody(testSubmitSchema), async (req, res) => {
  const moduleId = String(req.params.id)
  const courseId = await moduleCourseId(moduleId)
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
    select: { id: true },
  })
  if (!enrollment) throw new HttpError(403, 'You are not enrolled in this course')

  const test = await prisma.test.findUnique({
    where: { moduleId },
    select: {
      id: true,
      passingScore: true,
      maxAttempts: true,
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
  })
  if (!test) throw new HttpError(404, 'This section has no test')

  // Enforce the attempt limit (a per-learner allowance wins over the test default).
  const attemptLimit = await attemptLimitFor(test.id, req.user!.id, test.maxAttempts)
  const prior = await prisma.testAttempt.count({ where: { testId: test.id, enrollmentId: enrollment.id } })
  if (attemptLimit !== null && prior >= attemptLimit) {
    throw new HttpError(403, 'You have used all your attempts for this test')
  }

  const { answers, screenRecordingId, cameraRecordingId } = req.body as {
    answers: { questionId: string; selectedOptionIds: string[] }[]
    screenRecordingId?: string | null
    cameraRecordingId?: string | null
  }
  const chosenBy = new Map(answers.map((a) => [a.questionId, new Set(a.selectedOptionIds)]))

  // Grade each question once — full credit only when the selection matches exactly.
  // The snapshot freezes the wording and options this learner actually saw.
  const graded = test.questions.map((q, i) => {
    const correctIds = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id))
    const chosen = [...(chosenBy.get(q.id) ?? new Set<string>())]
    const isCorrect = chosen.length === correctIds.size && chosen.every((id) => correctIds.has(id))
    return {
      questionId: q.id,
      chosen,
      isCorrect,
      points: q.points,
      snapshot: {
        position: i,
        questionText: q.questionText,
        type: q.type,
        points: q.points,
        options: q.options.map((o) => ({ id: o.id, optionText: o.optionText, isCorrect: o.isCorrect })),
      },
    }
  })
  const totalPoints = graded.reduce((s, g) => s + g.points, 0)
  const earned = graded.reduce((s, g) => s + (g.isCorrect ? g.points : 0), 0)
  const correctCount = graded.filter((g) => g.isCorrect).length
  const score = totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0
  const passed = score >= test.passingScore

  const attempt = await prisma.testAttempt.create({
    data: {
      testId: test.id,
      enrollmentId: enrollment.id,
      attemptNumber: prior + 1,
      score,
      passed,
      submittedAt: new Date(),
      screenRecordingId: screenRecordingId ?? null,
      cameraRecordingId: cameraRecordingId ?? null,
      answers: {
        create: graded.map((g) => ({
          questionId: g.questionId,
          questionSnapshot: g.snapshot,
          selectedOptionIds: g.chosen,
          isCorrect: g.isCorrect,
          pointsAwarded: g.isCorrect ? g.points : 0,
        })),
      },
    },
    select: { id: true, attemptNumber: true },
  })

  // Overall pass/fail is judged on the learner's BEST attempt.
  const agg = await prisma.testAttempt.aggregate({
    where: { testId: test.id, enrollmentId: enrollment.id },
    _max: { score: true },
  })
  const bestScore = agg._max.score ?? score
  const progress = await recomputeEnrollmentProgress(enrollment.id, courseId)
  const attemptsUsed = prior + 1

  res.status(201).json({
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    passed,
    score,
    bestScore,
    passedOverall: bestScore >= test.passingScore,
    passingScore: test.passingScore,
    correctCount,
    totalQuestions: test.questions.length,
    testId: test.id,
    attemptsUsed,
    attemptLimit,
    attemptsLeft: attemptLimit === null ? null : Math.max(0, attemptLimit - attemptsUsed),
    progress,
  })
})
