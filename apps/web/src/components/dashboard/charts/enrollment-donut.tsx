'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useChartColors } from '@/lib/chart-theme'

export function EnrollmentDonut({
  completed,
  inProgress,
  notStarted,
  centerLabel,
  centerSub = 'complete',
}: {
  completed: number
  inProgress: number
  notStarted: number
  centerLabel: string
  centerSub?: string
}) {
  const c = useChartColors()
  const total = completed + inProgress + notStarted
  const data = [
    { key: 'completed', name: 'Completed', value: completed, color: c.completed },
    { key: 'inProgress', name: 'In progress', value: inProgress, color: c.accent },
    { key: 'notStarted', name: 'Not started', value: notStarted, color: c.notStarted },
  ]
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={total > 0 ? 2 : 0}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              wrapperStyle={{ zIndex: 1000 }}
              formatter={(value, name) => {
                const v = Number(value) || 0
                return [`${v} (${pct(v)}%)`, String(name)]
              }}
              contentStyle={{
                background: c.card,
                border: `1px solid ${c.grid}`,
                borderRadius: 10,
                color: c.fg,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{centerLabel}</span>
          <span className="text-xs text-muted">{centerSub}</span>
        </div>
      </div>

      <ul className="w-full max-w-[200px] space-y-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="text-muted">{d.name}</span>
            <span className="ml-auto font-semibold">{d.value}</span>
            <span className="w-9 text-right text-xs text-muted">{pct(d.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
