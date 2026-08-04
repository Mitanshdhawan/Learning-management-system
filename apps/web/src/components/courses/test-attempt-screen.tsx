'use client'

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  Loader2,
  Monitor,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiGet, apiPost, uploadMedia } from '@/lib/api'

type QType = 'single_choice' | 'multiple_choice' | 'true_false'
interface TakeQuestion {
  id: string
  questionText: string
  type: QType
  points: number
  options: { id: string; optionText: string }[]
}
interface TakeTest {
  id: string
  title: string
  isRequired: boolean
  passingScore: number
  questions: TakeQuestion[]
}
interface AttemptResult {
  passed: boolean
  score: number
  bestScore: number
  passedOverall: boolean
  passingScore: number
  correctCount: number
  totalQuestions: number
  testId: string
  attemptNumber: number
  attemptsLeft: number | null
}

type Phase = 'loading' | 'permissions' | 'active' | 'submitting' | 'result'

const MAX_VIOLATIONS = 3

function pickMime() {
  const prefs = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  if (typeof MediaRecorder === 'undefined') return ''
  return prefs.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function TestAttemptScreen({
  moduleId,
  courseSlug,
  onClose,
  onResult,
}: {
  moduleId: string
  courseSlug: string
  onClose: () => void
  onResult: (passed: boolean, testId: string) => void
}) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [test, setTest] = useState<TakeTest | null>(null)
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({})
  const [camReady, setCamReady] = useState(false)
  const [screenReady, setScreenReady] = useState(false)
  const [permError, setPermError] = useState<string | null>(null)
  const [violations, setViolations] = useState(0)
  const [warning, setWarning] = useState<string | null>(null)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [attemptLimit, setAttemptLimit] = useState<number | null>(null)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [uploadNote, setUploadNote] = useState<string | null>(null)
  const [recordingIssue, setRecordingIssue] = useState<string | null>(null)
  const uploadedRecordingId = useRef<string | null>(null)

  const camStream = useRef<MediaStream | null>(null)
  const screenStream = useRef<MediaStream | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const camVideo = useRef<HTMLVideoElement | null>(null)
  const submittedRef = useRef(false)
  const phaseRef = useRef<Phase>('loading')
  phaseRef.current = phase

  // One <video> shows the live camera in both the pre-flight and the corner PiP.
  const attachCam = useCallback((el: HTMLVideoElement | null) => {
    camVideo.current = el
    if (el && camStream.current && el.srcObject !== camStream.current) {
      el.srcObject = camStream.current
      el.play().catch(() => {})
    }
  }, [])

  /* ---- load the test ---- */
  useEffect(() => {
    let alive = true
    // `phase` only ever advances out of 'loading' here. Guard both the stale
    // response (React runs effects twice in dev, so two requests are in flight)
    // and the slow one — a reply landing after the learner has started must not
    // throw them back to the permission screen mid-test.
    const toPermissions = () => setPhase((p) => (p === 'loading' ? 'permissions' : p))

    apiGet<{
      test: TakeTest
      attemptsUsed: number
      attemptLimit: number | null
      attemptsLeft: number | null
    }>(`/modules/${moduleId}/test/take`)
      .then((d) => {
        if (!alive) return
        setTest(d.test)
        setAttemptsUsed(d.attemptsUsed)
        setAttemptLimit(d.attemptLimit)
        setAttemptsLeft(d.attemptsLeft)
        toPermissions()
      })
      .catch((e) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Could not load the test')
        toPermissions()
      })

    return () => {
      alive = false
    }
  }, [moduleId])

  /* ---- teardown on unmount ---- */
  const stopEverything = useCallback(() => {
    ;[camStream.current, screenStream.current].forEach((s) => s?.getTracks().forEach((t) => t.stop()))
    camStream.current = null
    screenStream.current = null
    audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])
  useEffect(() => () => stopEverything(), [stopEverything])

  /* ---- permission grants (must be user-gesture triggered) ---- */
  async function enableCamera() {
    setPermError(null)
    try {
      // Modest resolution: the camera is only ever shown in the corner panel, and
      // what gets stored is the screen capture, not this stream.
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
        audio: true,
      })
      camStream.current = s
      setCamReady(true)
      attachCam(camVideo.current)
    } catch {
      setPermError('Camera and microphone access was blocked. Allow it in your browser to continue.')
    }
  }
  async function enableScreen() {
    setPermError(null)
    try {
      // Prefer the whole monitor and never exclude this tab — the camera PiP has to
      // land inside the capture. `audio: true` picks up system sound when offered.
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 8 },
          displaySurface: 'monitor',
        },
        audio: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
      } as unknown as DisplayMediaStreamOptions)
      screenStream.current = s
      setScreenReady(true)
      // If the learner stops sharing mid-test, treat it as a violation.
      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (phaseRef.current === 'active') registerViolation('Screen sharing was stopped.')
      })
    } catch {
      setPermError('Screen sharing was blocked or cancelled. It is required for this test.')
    }
  }

  /* ---- violations ---- */
  const registerViolation = useCallback((reason: string) => {
    if (phaseRef.current !== 'active' || submittedRef.current) return
    setViolations((v) => {
      const next = v + 1
      if (next >= MAX_VIOLATIONS) {
        setWarning('Too many violations — submitting your test automatically.')
        // submit shortly after so the warning is visible
        setTimeout(() => submit(), 900)
      } else {
        setWarning(`${reason} Do not leave the test window. Warning ${next} of ${MAX_VIOLATIONS}.`)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- proctor listeners while active ---- */
  useEffect(() => {
    if (phase !== 'active') return
    const onVis = () => document.hidden && registerViolation('You switched away from the test.')
    const onBlur = () => registerViolation('The test window lost focus.')
    const onFs = () => {
      if (!document.fullscreenElement) registerViolation('You exited full-screen.')
    }
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
    }
  }, [phase, registerViolation])

  /* ---- start the proctored session ---- */
  async function startTest() {
    if (!camStream.current || !screenStream.current || !test) return
    // Never stack recorders. A second one on the same stream interleaves its chunks
    // with the first, so the header ends up mid-file and nothing can decode it.
    if (rec.current && rec.current.state !== 'inactive') {
      setPhase('active')
      return
    }
    // A share that was cancelled between granting and starting would record nothing.
    const liveScreen = screenStream.current.getVideoTracks()[0]
    if (!liveScreen || liveScreen.readyState === 'ended') {
      screenStream.current = null
      setScreenReady(false)
      setPermError('Screen sharing ended. Share your screen again before starting.')
      return
    }
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      /* fullscreen optional if blocked */
    }
    const mime = pickMime()
    // Low bitrates keep an hour of footage in the tens of MB rather than GBs.
    const opts = {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 600_000,
      audioBitsPerSecond: 48_000,
    }
    try {
      // A single recording: the shared screen — which already shows the camera
      // corner — with the microphone (and system sound, if shared) mixed in.
      const videoTrack = screenStream.current.getVideoTracks()[0]
      const audioTracks: MediaStreamTrack[] = []
      try {
        const ctx = new AudioContext()
        audioCtx.current = ctx
        ctx.resume().catch(() => {})
        const dest = ctx.createMediaStreamDestination()
        const mic = camStream.current.getAudioTracks()
        if (mic.length > 0) ctx.createMediaStreamSource(new MediaStream(mic)).connect(dest)
        const sys = screenStream.current.getAudioTracks()
        if (sys.length > 0) ctx.createMediaStreamSource(new MediaStream(sys)).connect(dest)
        audioTracks.push(...dest.stream.getAudioTracks())
      } catch {
        // No mixing available — fall back to the raw microphone track.
        audioTracks.push(...camStream.current.getAudioTracks())
      }

      const mixed = new MediaStream(videoTrack ? [videoTrack, ...audioTracks] : audioTracks)
      // Each recorder owns its own array, captured in the closure — so chunks can
      // never be mixed between two recordings, whatever else goes wrong.
      const parts: Blob[] = []
      chunks.current = parts
      const recorder = new MediaRecorder(mixed, opts)
      recorder.ondataavailable = (e) => e.data.size && parts.push(e.data)
      recorder.start(1000)
      rec.current = recorder
    } catch {
      /* recording unsupported — proceed but note it */
    }
    setPhase('active')
  }

  /* ---- stop a recorder and hand back the finished blob ---- */
  function stopRecorder(r: MediaRecorder | null, parts: Blob[]): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!r) return resolve(null)
      const build = () => {
        try {
          resolve(parts.length > 0 ? new Blob(parts, { type: r.mimeType || 'video/webm' }) : null)
        } catch {
          resolve(null)
        }
      }
      // The recorder stops itself when the shared screen ends — e.g. the learner
      // clicks the browser's "Stop sharing" bar. Everything buffered until then is
      // still valid footage, so build the blob instead of throwing it away.
      if (r.state === 'inactive') return build()
      r.onstop = build
      try {
        r.requestData() // flush the current partial chunk
        r.stop()
      } catch {
        build()
      }
    })
  }

  /* ---- upload footage so a reviewer can play it back later ---- */
  async function uploadRecording(blob: Blob | null, name: string): Promise<string | null> {
    if (!blob || blob.size === 0) {
      setRecordingIssue('No footage was captured, so nothing could be saved for review.')
      return null
    }
    // Every valid WebM opens with the EBML magic number. If it doesn't, the capture
    // was assembled wrongly and no player will decode it — say so rather than
    // storing a file the reviewer can't open.
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
    if (!(head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3)) {
      setRecordingIssue('The recording was captured incompletely and may not play back.')
    }

    // A MediaRecorder mime like `video/webm;codecs=vp9,opus` carries an unquoted
    // comma. Sent as a multipart part's Content-Type it corrupts the server's
    // parser and the upload is rejected — so send only the bare essence.
    const cleanType = (blob.type || 'video/webm').split(';')[0].trim() || 'video/webm'
    const file = new File([blob], name, { type: cleanType })
    const mb = (blob.size / 1_000_000).toFixed(1)
    let lastErr: unknown = null

    // Footage is uploaded in one shot at the end, so a momentary network blip would
    // otherwise cost the whole recording. Retry a couple of times before giving up.
    for (let attempt = 1; attempt <= 3; attempt++) {
      setUploadNote(
        attempt === 1
          ? `Uploading proctoring footage (${mb} MB)…`
          : `Upload failed — retrying (${attempt - 1} of 2)…`,
      )
      try {
        const d = await uploadMedia<{ media: { id: string } }>(file)
        if (d.media?.id) return d.media.id
        lastErr = new Error('the server returned no file')
      } catch (e) {
        lastErr = e
        // Retry a dropped connection (fetch reports those as a TypeError) and a
        // server-side blip — a sleeping database waking up looks like a 500 on the
        // first request. A 4xx (too large, rejected, unauthorised) will just repeat.
        const retryable = e instanceof TypeError || (e instanceof ApiError && e.status >= 500)
        if (!retryable) break
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500))
    }

    // Never block submission on an upload failure — but say so rather than
    // silently ending up with an attempt that has no footage attached.
    console.warn('Proctoring upload failed', lastErr)
    setRecordingIssue(
      lastErr instanceof Error
        ? `The recording could not be uploaded (${lastErr.message}).`
        : 'The recording could not be uploaded.',
    )
    return null
  }

  /* ---- submit + auto-grade ---- */
  async function submit() {
    if (submittedRef.current || !test) return
    submittedRef.current = true
    setPhase('submitting')
    setWarning(null)
    setError(null)

    // Only stop and upload once. A retry after a failed grade reuses the same file
    // rather than re-uploading (or, if the upload itself failed, tries it again).
    if (!uploadedRecordingId.current) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const base = `${courseSlug}_${test.title.replace(/[^a-z0-9]+/gi, '-')}_${stamp}`

      setUploadNote('Finalising the recording…')
      const blob = await stopRecorder(rec.current, chunks.current)
      stopEverything()
      setRecordingIssue(null)
      uploadedRecordingId.current = await uploadRecording(blob, `${base}_screen.webm`)
    }

    setUploadNote('Grading your answers…')
    try {
      const payload = {
        answers: test.questions.map((q) => ({
          questionId: q.id,
          selectedOptionIds: [...(answers[q.id] ?? new Set<string>())],
        })),
        screenRecordingId: uploadedRecordingId.current,
        cameraRecordingId: null,
      }
      const r = await apiPost<AttemptResult>(`/modules/${moduleId}/test/attempt`, payload)
      setResult(r)
      setAttemptsLeft(r.attemptsLeft)
      setPhase('result')
      // The section unlocks on the learner's BEST attempt, not just this one.
      if (r.passedOverall) onResult(true, r.testId)
    } catch (e) {
      // Nothing was recorded server-side, so the learner can safely try again
      // without burning an attempt — their answers are still in state.
      setError(e instanceof Error ? e.message : 'Could not submit the test')
      submittedRef.current = false
      setPhase('result')
    }
  }

  /* ---- answer helpers ---- */
  function choose(q: TakeQuestion, optionId: string) {
    setAnswers((prev) => {
      const cur = new Set(prev[q.id] ?? [])
      if (q.type === 'multiple_choice') {
        cur.has(optionId) ? cur.delete(optionId) : cur.add(optionId)
      } else {
        cur.clear()
        cur.add(optionId)
      }
      return { ...prev, [q.id]: cur }
    })
  }

  const answeredCount = test ? test.questions.filter((q) => (answers[q.id]?.size ?? 0) > 0).length : 0
  const allAnswered = test ? answeredCount === test.questions.length : false

  /* =====================================================================
     RENDER
     ===================================================================== */
  const shell =
    'fixed inset-0 z-[100] flex flex-col bg-[#0d0b1f] text-white overflow-hidden'

  // ---- permissions / pre-flight ----
  if (phase === 'loading' || phase === 'permissions') {
    return (
      <div className={shell}>
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-10">
          <div className="mb-6 inline-flex items-center gap-2 self-start rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-violet-200">
            <ShieldCheck size={14} /> PROCTORED ASSESSMENT
          </div>
          <h1 className="text-3xl font-bold">{test?.title ?? 'Section test'}</h1>
          <p className="mt-2 text-sm text-violet-200/80">
            This test is monitored. Before you begin, enable the required access. Your camera sits in the corner
            of the screen and is captured inside a single screen recording, together with your microphone.
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <ul className="mt-6 space-y-2 text-sm text-violet-100/85">
            {[
              'Stay in full-screen — do not switch tabs or apps.',
              `${MAX_VIOLATIONS} violations will auto-submit your test.`,
              'Share your entire screen so your camera corner is captured too.',
              'The recording — screen, camera and microphone — goes to your manager.',
              `You need ${test?.passingScore ?? 70}% to pass — your best attempt counts.`,
              attemptLimit === null
                ? 'Unlimited attempts.'
                : `Attempt ${attemptsUsed + 1} of ${attemptLimit} — ${attemptsLeft} left.`,
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-violet-300" /> {t}
              </li>
            ))}
          </ul>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={enableCamera}
              disabled={camReady}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                camReady ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-white/15 bg-white/5 hover:bg-white/10'
              }`}
            >
              <Camera size={20} className={camReady ? 'text-emerald-300' : 'text-violet-300'} />
              <span>
                {camReady ? 'Camera & mic enabled' : 'Enable camera & microphone'}
                <span className="block text-xs font-normal text-violet-200/70">
                  Stays on in the corner of the test
                </span>
              </span>
              {camReady && <CheckCircle2 size={18} className="ml-auto text-emerald-300" />}
            </button>

            <button
              type="button"
              onClick={enableScreen}
              disabled={screenReady}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                screenReady ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-white/15 bg-white/5 hover:bg-white/10'
              }`}
            >
              <Monitor size={20} className={screenReady ? 'text-emerald-300' : 'text-violet-300'} />
              <span>
                {screenReady ? 'Screen sharing on' : 'Share your entire screen'}
                <span className="block text-xs font-normal text-violet-200/70">
                  Choose &ldquo;Entire screen&rdquo; when asked
                </span>
              </span>
              {screenReady && <CheckCircle2 size={18} className="ml-auto text-emerald-300" />}
            </button>
          </div>

          {/* live camera preview */}
          <div className="mt-4 flex items-center gap-3">
            <video
              ref={attachCam}
              autoPlay
              muted
              playsInline
              className={`h-20 w-28 rounded-lg border border-white/15 bg-black object-cover ${camReady ? '' : 'opacity-30'}`}
            />
            <p className="text-xs text-violet-200/70">
              {camReady
                ? 'You are on camera — this preview moves to the bottom-right during the test.'
                : 'Your camera preview appears here once enabled.'}
            </p>
          </div>

          {permError && (
            <p className="mt-4 rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
              {permError}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="text-sm text-violet-200/70 hover:text-white">
              Cancel
            </button>
            <button
              type="button"
              onClick={startTest}
              disabled={!camReady || !screenReady || !test || phase === 'loading'}
              className="rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === 'loading' ? 'Loading…' : 'Start test'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- result ----
  if (phase === 'result') {
    const ok = result?.passedOverall
    return (
      <div className={shell}>
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center px-6 text-center">
          {error ? (
            <>
              <XCircle size={56} className="text-red-400" />
              <h1 className="mt-4 text-2xl font-bold">Submission failed</h1>
              <p className="mt-2 text-sm text-violet-200/80">{error}</p>
              <p className="mt-2 text-xs text-violet-200/60">
                Your answers are still here and no attempt was used. Try again.
              </p>
              <button
                type="button"
                onClick={() => submit()}
                className="mt-5 rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                Submit again
              </button>
            </>
          ) : (
            <>
              {result?.passedOverall ? (
                <CheckCircle2 size={64} className="text-emerald-400" />
              ) : (
                <XCircle size={64} className="text-red-400" />
              )}
              <h1 className="mt-4 text-3xl font-bold">
                {result?.passedOverall ? 'Passed!' : 'Not passed'}
              </h1>
              <p className="mt-1 text-6xl font-bold tracking-tight">{result?.score}%</p>
              <p className="mt-2 text-sm text-violet-200/80">
                Attempt {result?.attemptNumber} · {result?.correctCount} of {result?.totalQuestions} correct ·
                pass mark {result?.passingScore}%
              </p>
              {result && result.bestScore !== result.score && (
                <p className="mt-1 text-sm font-medium text-violet-200">
                  Best attempt: {result.bestScore}% — that is the score that counts.
                </p>
              )}
              <p className="mt-4 text-xs text-violet-200/60">
                {result?.attemptsLeft === null
                  ? 'You can retake this test any number of times.'
                  : `${result?.attemptsLeft} attempt${result?.attemptsLeft === 1 ? '' : 's'} remaining.`}
              </p>
              {recordingIssue ? (
                <p className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
                  {recordingIssue} Your answers were still graded.
                </p>
              ) : (
                <p className="mt-1 text-xs text-violet-200/60">
                  Your screen recording — with camera and audio — was uploaded for review.
                </p>
              )}
            </>
          )}
          <div className="mt-8 flex gap-3">
            {!ok && !error && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/20 px-5 py-2 text-sm font-medium hover:bg-white/10"
              >
                Close &amp; retry later
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-violet-500 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-400"
            >
              {ok ? 'Continue' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- submitting ----
  if (phase === 'submitting') {
    return (
      <div className={shell}>
        <div className="m-auto flex flex-col items-center gap-3 text-violet-200">
          <Loader2 size={40} className="animate-spin" />
          <p className="text-sm">{uploadNote ?? 'Submitting your test…'}</p>
          <p className="text-xs text-violet-300/60">Please keep this window open.</p>
        </div>
      </div>
    )
  }

  // ---- active test ----
  return (
    <div className={shell}>
      {/* top bar */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-black/30 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> REC
          </span>
          <span className="text-sm font-semibold">{test?.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-violet-200/80">
            {answeredCount}/{test?.questions.length} answered
          </span>
          <span className={`text-xs font-medium ${violations ? 'text-amber-300' : 'text-violet-200/60'}`}>
            Warnings {violations}/{MAX_VIOLATIONS}
          </span>
        </div>
      </div>

      {/* questions */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0d0b1f]">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {test?.questions.map((q, qi) => {
            const chosen = answers[q.id] ?? new Set<string>()
            const multi = q.type === 'multiple_choice'
            return (
              <div key={q.id} className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3 flex items-start gap-3">
                  <span className="shrink-0 rounded-lg bg-violet-500/30 px-2.5 py-1 text-xs font-bold text-violet-200">
                    Q{qi + 1}
                  </span>
                  <p className="text-[15px] font-medium leading-snug">{q.questionText}</p>
                </div>
                <p className="mb-2 pl-11 text-xs text-violet-200/50">
                  {multi ? 'Select all that apply' : 'Select one'} · {q.points} pt{q.points === 1 ? '' : 's'}
                </p>
                <div className="space-y-2 pl-11">
                  {q.options.map((o) => {
                    const sel = chosen.has(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => choose(q, o.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                          sel ? 'border-violet-400 bg-violet-500/20' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.07]'
                        }`}
                      >
                        {sel ? (
                          <CheckCircle2 size={18} className="shrink-0 text-violet-300" />
                        ) : (
                          <Circle size={18} className="shrink-0 text-white/30" />
                        )}
                        {o.optionText}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => submit()}
            disabled={!allAnswered}
            className="w-full rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {allAnswered ? 'Submit test' : `Answer all questions to submit (${answeredCount}/${test?.questions.length})`}
          </button>
        </div>
      </div>

      {/* Camera picture-in-picture. Kept on screen on purpose: the screen capture
          records it, so one video ends up holding both the screen and the learner. */}
      <div className="pointer-events-none absolute bottom-5 right-5 z-20 overflow-hidden rounded-xl border-2 border-white/25 bg-black shadow-2xl">
        <video
          ref={attachCam}
          autoPlay
          muted
          playsInline
          className="h-[210px] w-[280px] object-cover sm:h-[270px] sm:w-[360px]"
        />
        <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-1 text-[11px] font-semibold text-red-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> REC
        </span>
        <span className="absolute bottom-2 left-2.5 text-[11px] font-medium text-white/75">
          Camera &amp; mic on
        </span>
      </div>

      {/* violation warning */}
      {warning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-6 max-w-md rounded-2xl border border-amber-400/40 bg-[#1a1533] p-6 text-center">
            <AlertTriangle size={40} className="mx-auto text-amber-400" />
            <p className="mt-3 text-sm text-amber-100">{warning}</p>
            <button
              type="button"
              onClick={() => setWarning(null)}
              className="mt-5 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              Return to test
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
