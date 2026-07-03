'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth, type AuthUser } from '@/components/auth-provider'
import { useTheme } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { apiPost } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { setTheme } = useTheme()
  const [email, setEmail] = useState('admin@toplms.local')
  const [password, setPassword] = useState('admin1234')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user, accessToken } = await apiPost<{ user: AuthUser; accessToken: string }>(
        '/auth/login',
        { email, password },
      )
      signIn(accessToken, user)
      setTheme(user.theme)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
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
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Welcome back. Enter your credentials to continue.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-card px-3 py-2 outline-none transition focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-card px-3 py-2 outline-none transition focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">Dev login: admin@toplms.local / admin1234</p>
      </main>
    </div>
  )
}
