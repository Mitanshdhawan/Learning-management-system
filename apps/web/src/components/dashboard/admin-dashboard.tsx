'use client'

import Link from 'next/link'
import { BookOpen, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { apiGet } from '@/lib/api'

interface Overview {
  totalUsers: number
  admins: number
  managers: number
  employees: number
  pendingInvites: number
  courses: number
}

export function AdminDashboard() {
  const { user } = useAuth()
  const [ov, setOv] = useState<Overview | null>(null)

  useEffect(() => {
    apiGet<Overview>('/admin/overview')
      .then(setOv)
      .catch(() => {})
  }, [])

  const stats = ov
    ? [
        { label: 'Total users', value: ov.totalUsers },
        { label: 'Managers', value: ov.managers },
        { label: 'Employees', value: ov.employees },
        { label: 'Pending invites', value: ov.pendingInvites },
        { label: 'Courses', value: ov.courses },
      ]
    : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.fullName ?? 'Admin'}</h1>
        <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening in your organisation.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
          >
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/users"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent transition duration-200 group-hover:scale-110">
            <Users size={20} />
          </span>
          <div>
            <p className="font-semibold">Manage users</p>
            <p className="text-sm text-muted">Invite, search and organise people.</p>
          </div>
        </Link>
        <Link
          href="/dashboard/courses"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent transition duration-200 group-hover:scale-110">
            <BookOpen size={20} />
          </span>
          <div>
            <p className="font-semibold">Courses</p>
            <p className="text-sm text-muted">Build and publish learning content.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
