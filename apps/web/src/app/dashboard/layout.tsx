'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { Sidebar } from '@/components/dashboard/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading…</div>
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm text-white shadow-sm shadow-accent/30">
              T
            </span>
            TOP LMS
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-muted transition duration-200 hover:bg-card hover:text-foreground"
            >
              <Avatar user={user} size={30} />
              <span className="hidden capitalize sm:inline">{user.fullName ?? user.email}</span>
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg px-2 py-1 text-muted transition duration-200 hover:bg-card hover:text-foreground"
            >
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <Sidebar />
        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
