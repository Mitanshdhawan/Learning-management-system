'use client'

import { Check, Copy, Search, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, type AuthUser } from '@/components/auth-provider'
import { UserCard } from '@/components/dashboard/user-card'
import { Select } from '@/components/ui/select'
import { apiGet, apiPost } from '@/lib/api'

type Filter = 'all' | 'employee' | 'manager' | 'admin'

function InviteForm({ managers, onDone }: { managers: AuthUser[]; onDone: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'employee' | 'manager'>('employee')
  const [managerId, setManagerId] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLink(null)
    setCopied(false)
    setBusy(true)
    try {
      const payload: { email: string; role: string; managerId?: string } = { email, role }
      if (role === 'employee' && managerId) payload.managerId = managerId
      const res = await apiPost<{ acceptUrl?: string }>('/invitations', payload)
      setLink(res.acceptUrl ?? null)
      setEmail('')
      setManagerId('')
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="email"
          required
          placeholder="person@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
        />
        <Select
          ariaLabel="Role"
          className="sm:w-40"
          value={role}
          onChange={(v) => {
            const next = v as 'employee' | 'manager'
            setRole(next)
            if (next === 'manager') setManagerId('')
          }}
          options={[
            { value: 'employee', label: 'Employee' },
            { value: 'manager', label: 'Manager' },
          ]}
        />
        {role === 'employee' && (
          <Select
            ariaLabel="Reports to"
            className="sm:w-56"
            placeholder="No manager"
            value={managerId}
            onChange={setManagerId}
            options={[
              { value: '', label: 'No manager' },
              ...managers.map((m) => ({ value: m.id, label: `Reports to: ${m.fullName ?? m.email}` })),
            ]}
          />
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send invite'}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {link && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="mb-2 text-sm font-medium">
            Invitation created — share this link with the person to let them join:
          </p>
          <div className="flex items-center gap-2">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-accent underline"
            >
              {link}
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  /* clipboard blocked — the link is still selectable above */
                }
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-accent/60"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            The link expires in 7 days.
          </p>
        </div>
      )}
    </div>
  )
}

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)

  const load = useCallback(async () => {
    const d = await apiGet<{ users: AuthUser[] }>('/users')
    setUsers(d.users)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isAdmin = user?.role === 'admin'
  // Admins can also have direct reports, so they're assignable as a manager too.
  const managers = useMemo(
    () => users.filter((u) => u.role === 'manager' || u.role === 'admin'),
    [users],
  )

  const filters: { key: Filter; label: string }[] = isAdmin
    ? [
        { key: 'all', label: 'All' },
        { key: 'employee', label: 'Employees' },
        { key: 'manager', label: 'Managers' },
        { key: 'admin', label: 'Admins' },
      ]
    : [{ key: 'all', label: 'All' }]

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter !== 'all' && u.role !== filter) return false
      if (q && !`${u.fullName ?? ''} ${u.email}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, filter, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? 'All users' : 'My team'}</h1>
          <p className="mt-1 text-sm text-muted">
            {isAdmin ? 'Everyone in your organisation.' : 'People who report to you.'}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowInvite((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition duration-200 hover:opacity-90"
          >
            <UserPlus size={16} />
            Invite user
          </button>
        )}
      </div>

      {isAdmin && showInvite && <InviteForm managers={managers} onDone={load} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition duration-200 ${
                filter === f.key ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition focus:border-accent"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">
          No users match your filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  )
}
