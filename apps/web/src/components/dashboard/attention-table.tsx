'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Avatar } from '@/components/avatar'

interface OverdueItem {
  userId: string
  userName: string
  avatar: { storageKey: string; provider: string } | null
  courseTitle: string
  courseSlug: string
  dueDate: string
  daysOverdue: number
  progressPercent: number
  managerName?: string | null
}

interface StalledItem {
  userId: string
  userName: string
  avatar: { storageKey: string; provider: string } | null
  courseTitle: string
  courseSlug: string
  progressPercent: number
  daysInactive: number
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function MiniBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  )
}

/** Who is overdue on a mandatory course — the actionable worklist. */
export function OverdueTable({
  items,
  total,
  showManager = false,
  cap = 15,
}: {
  items: OverdueItem[]
  total: number
  showManager?: boolean
  cap?: number
}) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={16} /> Nothing overdue — every mandatory course is on track.
      </div>
    )
  }
  const shown = items.slice(0, cap)
  return (
    <div>
      <div className="divide-y divide-border">
        {shown.map((it) => (
          <div key={`${it.userId}-${it.courseSlug}`} className="flex items-center gap-3 py-2.5">
            <Avatar user={{ fullName: it.userName, email: '', avatar: it.avatar }} size={34} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/users/${it.userId}`}
                className="block truncate text-sm font-medium hover:text-accent"
              >
                {it.userName}
              </Link>
              <p className="truncate text-xs text-muted">
                <Link href={`/dashboard/courses/${it.courseSlug}`} className="hover:text-accent">
                  {it.courseTitle}
                </Link>
                {showManager && it.managerName ? <> · Mgr: {it.managerName}</> : null}
                {' · due '}
                {fmtDate(it.dueDate)}
              </p>
            </div>
            <div className="hidden sm:block">
              <MiniBar percent={it.progressPercent} />
              <p className="mt-1 text-right text-[11px] text-muted">{it.progressPercent}%</p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                it.daysOverdue <= 3
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-red-500/15 text-red-500'
              }`}
            >
              <AlertTriangle size={11} /> {it.daysOverdue}d
            </span>
          </div>
        ))}
      </div>
      {total > shown.length && (
        <p className="mt-3 text-xs text-muted">
          Showing {shown.length} of {total} overdue.
        </p>
      )}
    </div>
  )
}

/** Learners who started but went quiet — the "who to nudge" list. */
export function StalledList({ items, total }: { items: StalledItem[]; total: number }) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
        <CheckCircle2 size={16} className="text-emerald-500" /> Everyone in progress has been active recently.
      </div>
    )
  }
  return (
    <div className="divide-y divide-border">
      {items.map((it) => (
        <div key={`${it.userId}-${it.courseSlug}`} className="flex items-center gap-3 py-2.5">
          <Avatar user={{ fullName: it.userName, email: '', avatar: it.avatar }} size={34} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/dashboard/users/${it.userId}`}
              className="block truncate text-sm font-medium hover:text-accent"
            >
              {it.userName}
            </Link>
            <p className="truncate text-xs text-muted">
              <Link href={`/dashboard/courses/${it.courseSlug}`} className="hover:text-accent">
                {it.courseTitle}
              </Link>{' '}
              · {it.progressPercent}% done
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Clock size={11} /> {it.daysInactive}d idle
          </span>
        </div>
      ))}
    </div>
  )
}
