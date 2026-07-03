'use client'

import { type AuthUser } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { Select } from '@/components/ui/select'

const roleBadge: Record<string, string> = {
  admin: 'border-accent/40 bg-accent/10 text-accent',
  manager: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  employee: 'border-border bg-background text-muted',
}

interface Props {
  user: AuthUser
  managers: AuthUser[]
  canManage: boolean
  onReassign: (userId: string, managerId: string | null) => void
}

export function UserCard({ user, managers, canManage, onReassign }: Props) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5">
      <div className="flex items-center gap-4">
        <div className="transition duration-200 group-hover:scale-105">
          <Avatar user={user} size={56} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.fullName ?? 'Pending'}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${roleBadge[user.role] ?? roleBadge.employee}`}
        >
          {user.role}
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs capitalize text-muted">
          {user.status}
        </span>
      </div>

      {canManage && user.role === 'employee' && (
        <div className="mt-4 border-t border-border pt-3">
          <label className="mb-1 block text-xs text-muted">Reports to</label>
          <Select
            ariaLabel={`Manager for ${user.email}`}
            value={user.managerId ?? ''}
            onChange={(v) => onReassign(user.id, v || null)}
            options={[
              { value: '', label: 'No manager' },
              ...managers
                .filter((m) => m.id !== user.id)
                .map((m) => ({ value: m.id, label: m.fullName ?? m.email })),
            ]}
          />
        </div>
      )}
    </div>
  )
}
