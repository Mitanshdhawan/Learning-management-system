'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { type AuthUser } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
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
  currentUserId?: string
  onReassign: (userId: string, managerId: string | null) => void
  onDelete?: (user: AuthUser) => Promise<void>
}

export function UserCard({ user, managers, canManage, currentUserId, onReassign, onDelete }: Props) {
  const [showDelete, setShowDelete] = useState(false)
  const canDelete = canManage && !!onDelete && user.id !== currentUserId

  return (
    <div className="group relative rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5">
      {canDelete && (
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          aria-label={`Delete ${user.email}`}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted transition duration-200 hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 size={16} />
        </button>
      )}

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

      {showDelete && onDelete && (
        <ConfirmDeleteModal
          title="Delete this user?"
          confirmText={user.email}
          confirmHint="User's email"
          description={
            <>
              This permanently deletes{' '}
              <span className="font-medium text-foreground">{user.fullName ?? user.email}</span> and revokes their
              access. This cannot be undone.
            </>
          }
          confirmLabel="Delete user"
          onCancel={() => setShowDelete(false)}
          onConfirm={() => onDelete(user)}
        />
      )}
    </div>
  )
}
