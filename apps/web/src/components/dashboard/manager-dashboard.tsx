'use client'

import Link from 'next/link'
import { CheckCircle, GraduationCap, Users } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

export function ManagerDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.fullName ?? 'Manager'}</h1>
        <p className="mt-1 text-sm text-muted">Keep your team learning and on track.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/dashboard/users"
          className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent transition duration-200 group-hover:scale-110">
            <Users size={20} />
          </span>
          <p className="mt-4 font-semibold">My team</p>
          <p className="mt-1 text-sm text-muted">See who reports to you.</p>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-background text-muted">
            <GraduationCap size={20} />
          </span>
          <p className="mt-4 font-semibold">Assign courses</p>
          <p className="mt-1 text-sm text-muted">Coming soon.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-background text-muted">
            <CheckCircle size={20} />
          </span>
          <p className="mt-4 font-semibold">Approvals</p>
          <p className="mt-1 text-sm text-muted">Coming soon.</p>
        </div>
      </div>
    </div>
  )
}
