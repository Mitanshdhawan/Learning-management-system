'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartColors } from '@/lib/chart-theme'

interface Point {
  weekLabel: string
  enrolled: number
  completed: number
}

export function TrendArea({ data }: { data: Point[] }) {
  const c = useChartColors()
  const allZero = data.every((d) => d.enrolled === 0 && d.completed === 0)

  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
          <XAxis dataKey="weekLabel" tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
          <YAxis allowDecimals={false} tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            contentStyle={{ background: c.card, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.fg, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="enrolled"
            name="Enrolments"
            stroke={c.accent}
            fill={c.accent}
            fillOpacity={0.12}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="Completions"
            stroke={c.completed}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {allZero && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-lg bg-card/80 px-3 py-1 text-xs text-muted">
            No enrolments or completions in this period
          </span>
        </div>
      )}
      <div className="mt-1 flex justify-center gap-5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent }} /> Enrolments
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.completed }} /> Completions
        </span>
      </div>
    </div>
  )
}
