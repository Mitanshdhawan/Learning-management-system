'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading…</div>
  }

  // The course player is immersive — no top nav, no side nav, just the player + curriculum.
  if (pathname.endsWith('/learn')) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="-ml-1 rounded-lg p-2 text-muted transition duration-200 hover:bg-card hover:text-foreground md:hidden"
            >
              <Menu size={20} />
            </button>
            <Link href="/dashboard" className="flex items-center" aria-label="TOP - The Outsource Pro">
              <Logo className="h-9" />
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-muted transition duration-200 hover:bg-card hover:text-foreground"
            >
              <Avatar user={user} size={30} />
              <span className="hidden capitalize sm:inline">{user.fullName ?? user.email}</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
