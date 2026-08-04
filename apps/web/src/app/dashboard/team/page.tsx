'use client'

import Link from 'next/link'
import { Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { apiGet } from '@/lib/api'

interface TeamMember {
  id: string
  email: string
  fullName: string | null
  role: 'admin' | 'manager' | 'employee'
  status: string
  avatar: { storageKey: string; provider: string } | null
  courseCount: number
  completedCourses: number
  avgProgress: number
}

const roleBadge: Record<string, string> = {
  admin: 'border-accent/40 bg-accent/10 text-accent',
  manager: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  employee: 'border-border bg-background text-muted',
}

function MemberCard({ m }: { m: TeamMember }) {
  const done = m.courseCount > 0 && m.completedCourses === m.courseCount
  return (
    <Link
      href={`/dashboard/team/${m.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5"
    >
      <div className="flex items-center gap-4">
        <div className="transition duration-200 group-hover:scale-105">
          <Avatar user={m} size={52} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{m.fullName ?? 'Pending'}</p>
          <p className="truncate text-sm text-muted">{m.email}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${roleBadge[m.role] ?? roleBadge.employee}`}
        >
          {m.role}
        </span>
        {m.status !== 'active' && (
          <span className="rounded-full border border-border px-2.5 py-1 text-xs capitalize text-muted">
            {m.status}
          </span>
        )}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted">
            {m.courseCount === 0
              ? 'Not enrolled yet'
              : `${m.completedCourses} / ${m.courseCount} courses done`}
          </span>
          <span className={`font-semibold ${done ? 'text-emerald-500' : 'text-accent'}`}>
            {m.avgProgress}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : 'bg-accent'}`}
            style={{ width: `${m.avgProgress}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

export default function TeamPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiGet<{ members: TeamMember[] }>('/team')
      .then((d) => setMembers(d.members))
      .catch(() => setMembers([]))
  }, [])

  const isAdmin = user?.role === 'admin'

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (members ?? []).filter(
      (m) => !q || `${m.fullName ?? ''} ${m.email}`.toLowerCase().includes(q),
    )
  }, [members, search])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Team</h1>
        <p className="mt-1 text-sm text-muted">
          People who report to you - open anyone to track their course progress.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition focus:border-accent"
        />
      </div>

      {members === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <Users size={40} className="mx-auto text-accent/50" />
          <h2 className="mt-4 font-semibold">
            {members.length === 0 ? 'No team members yet' : 'No one matches your search'}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {members.length === 0
              ? isAdmin
                ? 'No one reports to you yet. Set someone’s manager to you on the Users page and they’ll appear here.'
                : 'Employees assigned to you will appear here.'
              : 'Try a different name or email.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}
