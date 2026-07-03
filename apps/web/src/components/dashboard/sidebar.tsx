'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, LayoutDashboard, Users } from 'lucide-react'
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

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  if (!user) return null

  const items = NAV[user.role]

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-border p-4 md:block">
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active =
            item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 ${
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted hover:bg-card hover:text-foreground'
              }`}
            >
              <Icon size={18} className="transition group-hover:scale-110" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
