'use client'

import Link from 'next/link'
import { useAuth } from './auth-provider'

export function AuthStatus() {
  const { user, loading, signOut } = useAuth()

  if (loading) return <span className="h-5 w-20" aria-hidden="true" />

  if (user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/dashboard" className="text-muted transition hover:text-foreground">
          Dashboard
        </Link>
        <span className="text-muted">
          {user.fullName ?? user.email}
          <span className="ml-1.5 rounded-full border border-border px-1.5 py-0.5 text-xs capitalize">
            {user.role}
          </span>
        </span>
        <button
          type="button"
          onClick={signOut}
          className="text-muted transition hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <Link href="/login" className="text-sm text-muted transition hover:text-foreground">
      Sign in
    </Link>
  )
}
