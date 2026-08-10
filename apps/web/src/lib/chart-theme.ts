'use client'

import { useEffect, useState } from 'react'

export interface ChartColors {
  accent: string // in-progress / primary
  completed: string
  notStarted: string
  overdue: string
  warn: string
  muted: string // axis labels
  grid: string // gridlines / neutral track
  card: string // tooltip background
  fg: string // tooltip text
}

// Recharts renders raw SVG and can't read Tailwind classes, so pull the app's
// CSS variables (space-separated RGB triples) into concrete color strings.
function read(): ChartColors {
  const fallback: ChartColors = {
    accent: '#4f46e5',
    completed: '#10b981',
    notStarted: '#e2e8f0',
    overdue: '#ef4444',
    warn: '#f59e0b',
    muted: '#64748b',
    grid: '#e2e8f0',
    card: '#ffffff',
    fg: '#0f172a',
  }
  if (typeof window === 'undefined') return fallback
  const cs = getComputedStyle(document.documentElement)
  const rgb = (name: string, fb: string) => {
    const v = cs.getPropertyValue(name).trim()
    return v ? `rgb(${v})` : fb
  }
  return {
    accent: rgb('--accent', fallback.accent),
    completed: '#10b981', // emerald — same in both themes, reads well on light & dark cards
    notStarted: rgb('--border', fallback.notStarted),
    overdue: '#ef4444',
    warn: '#f59e0b',
    muted: rgb('--muted', fallback.muted),
    grid: rgb('--border', fallback.grid),
    card: rgb('--card', fallback.card),
    fg: rgb('--fg', fallback.fg),
  }
}

/** Theme-aware chart palette that recomputes when the user toggles light/dark. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(read)
  useEffect(() => {
    const update = () => setColors(read())
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => obs.disconnect()
  }, [])
  return colors
}
