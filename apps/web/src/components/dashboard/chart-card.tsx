'use client'

import type { ReactNode } from 'react'

/** A titled card that reserves a fixed chart height so the grid never jumps on load. */
export function ChartCard({
  title,
  action,
  height = 260,
  loading,
  empty,
  emptyText,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  height?: number
  loading?: boolean
  empty?: boolean
  emptyText?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {loading ? (
        <div
          className="animate-pulse rounded-xl bg-border/40"
          style={{ height }}
          aria-hidden
        />
      ) : empty ? (
        <div
          className="grid place-items-center rounded-xl border border-dashed border-border text-center text-sm text-muted"
          style={{ height }}
        >
          <span className="max-w-xs px-4">{emptyText ?? 'No data yet.'}</span>
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  )
}
