'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, LayoutDashboard, Users, X } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'

const NAV = {
  admin: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/users', label: 'All Users', icon: Users },
    { href: '/dashboard/courses', label: 'All Courses', icon: BookOpen },
  ],
  manager: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/users', label: 'My Team', icon: Users },
    { href: '/dashboard/courses', label: 'All Courses', icon: BookOpen },
  ],
  employee: [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/courses', label: 'My Courses', icon: BookOpen },
  ],
} as const

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard }

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly NavItem[]
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
              active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-card hover:text-foreground'
            }`}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const { user } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onClose])

  if (!user) return null

  const items = NAV[user.role]

  return (
    <>
      {/* Desktop: static sidebar */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-border p-4 md:block">
        <NavLinks items={items} pathname={pathname} />
      </aside>

      {/* Mobile: slide-in drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div key="mobile-nav" className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-background p-4 shadow-2xl shadow-black/30"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted">Menu</span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="rounded-lg p-1.5 text-muted transition hover:bg-card hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <NavLinks items={items} pathname={pathname} onNavigate={onClose} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
