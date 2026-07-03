'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth, type AuthUser } from '@/components/auth-provider'
import { Avatar } from '@/components/avatar'
import { AvatarCropModal } from '@/components/avatar-crop-modal'
import { Select } from '@/components/ui/select'
import { apiDelete, apiGet, apiPatch, uploadAvatar } from '@/lib/api'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const { user, refresh, signOut } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const isAdmin = user?.role === 'admin'
  const locked = !isAdmin // role / reports-to / delete are admin-only

  const [name, setName] = useState(user?.fullName ?? '')
  const [managers, setManagers] = useState<AuthUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)

  useEffect(() => {
    setName(user?.fullName ?? '')
  }, [user?.fullName])

  useEffect(() => {
    if (isAdmin) {
      apiGet<{ users: AuthUser[] }>('/users')
        .then((d) => setManagers(d.users.filter((u) => u.role === 'manager')))
        .catch(() => {})
    }
  }, [isAdmin])

  if (!user) return null

  async function run(fn: () => Promise<unknown>, label = 'Something went wrong') {
    setError(null)
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : label)
    } finally {
      setBusy(false)
    }
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) setCropFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onCropped(blob: Blob) {
    setCropFile(null)
    await run(() => uploadAvatar(blob), 'Upload failed')
  }

  async function deleteAccount() {
    if (!window.confirm('Delete your account? This cannot be undone.')) return
    setError(null)
    try {
      await apiDelete(`/users/${user!.id}`)
      await signOut()
      router.push('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My profile</h1>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Avatar user={user} size={80} />
        <div>
          <input type="file" accept="image/*" ref={fileRef} onChange={onFilePick} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition duration-200 hover:border-accent/60 hover:bg-background disabled:opacity-60"
          >
            {busy ? 'Working…' : 'Change photo'}
          </button>
          <p className="mt-1 text-xs text-muted">JPG or PNG, up to 5 MB.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Field label="Full name">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 outline-none transition focus:border-accent"
            />
            <button
              type="button"
              onClick={() => run(() => apiPatch('/auth/me', { fullName: name.trim() }), 'Could not save')}
              disabled={busy || !name.trim() || name === user.fullName}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </Field>

        <Field label="Email">
          <input
            value={user.email}
            disabled
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-muted"
          />
        </Field>

        <Field label="Role">
          <Select
            ariaLabel="Role"
            disabled={locked}
            value={user.role}
            onChange={(v) => run(() => apiPatch(`/users/${user.id}`, { role: v }), 'Could not change role')}
            options={[
              { value: 'employee', label: 'Employee' },
              { value: 'manager', label: 'Manager' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        </Field>

        <Field label="Reports to">
          {isAdmin ? (
            <Select
              ariaLabel="Reports to"
              placeholder="No manager"
              value={user.managerId ?? ''}
              onChange={(v) =>
                run(() => apiPatch(`/users/${user.id}`, { managerId: v || null }), 'Could not update')
              }
              options={[
                { value: '', label: 'No manager' },
                ...managers
                  .filter((m) => m.id !== user.id)
                  .map((m) => ({ value: m.id, label: m.fullName ?? m.email })),
              ]}
            />
          ) : (
            <input
              value={user.manager ? (user.manager.fullName ?? user.manager.email) : 'No manager'}
              disabled
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-muted"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <input
              value={user.status}
              disabled
              className="w-full rounded-lg border border-border bg-background px-3 py-2 capitalize text-muted"
            />
          </Field>
          <Field label="Theme">
            <input
              value={user.theme}
              disabled
              className="w-full rounded-lg border border-border bg-background px-3 py-2 capitalize text-muted"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/30 bg-card p-6 shadow-sm">
        <h2 className="font-semibold">Delete account</h2>
        <p className="mt-1 text-sm text-muted">Permanently remove this account. This cannot be undone.</p>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={locked}
          className="mt-4 rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-500 transition duration-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete account
        </button>
        {locked && (
          <p className="mt-2 text-xs text-muted">
            Only admins can change roles, reassign managers, or delete accounts.
          </p>
        )}
      </div>

      {cropFile && (
        <AvatarCropModal file={cropFile} onCancel={() => setCropFile(null)} onCropped={onCropped} />
      )}
    </div>
  )
}
