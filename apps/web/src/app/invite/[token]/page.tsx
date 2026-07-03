'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth, type AuthUser } from '@/components/auth-provider'
import { useTheme } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { apiGet, apiPost } from '@/lib/api'

interface InviteInfo {
  email: string
  role: string
}

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const router = useRouter()
  const { signIn } = useAuth()
  const { setTheme } = useTheme()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [invalid, setInvalid] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    apiGet<InviteInfo>(`/invitations/${token}`, { token: null })
      .then((data) => {
        if (active) {
          setInvite(data)
          setChecking(false)
        }
      })
      .catch((err) => {
        if (active) {
          setInvalid(err instanceof Error ? err.message : 'This invitation is invalid')
          setChecking(false)
        }
      })
    return () => {
      active = false
    }
  }, [token])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { user, accessToken } = await apiPost<{ user: AuthUser; accessToken: string }>(
        '/auth/accept',
        { token, fullName, password },
        { token: null },
      )
      signIn(accessToken, user)
      setTheme(user.theme)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-semibold tracking-tight">
          TOP LMS
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex max-w-sm flex-col px-6 py-16">
        {checking && <p className="text-sm text-muted">Validating your invitation…</p>}

        {!checking && invalid && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <h1 className="text-lg font-semibold">Invitation not valid</h1>
            <p className="mt-2 text-sm text-muted">{invalid}</p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-background"
            >
              Go to sign in
            </Link>
          </div>
        )}

        {!checking && invite && (
          <>
            <h1 className="text-2xl font-bold">You&apos;re invited 🎉</h1>
            <p className="mt-2 text-sm text-muted">
              Set up your account for{' '}
              <span className="font-medium text-foreground">{invite.email}</span>{' '}
              <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                {invite.role}
              </span>
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="fullName" className="mb-1 block text-sm font-medium">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium">
                  Choose a password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 outline-none transition focus:border-accent"
                />
                <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Create account & sign in'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
