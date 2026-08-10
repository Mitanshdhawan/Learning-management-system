'use client'

import { useRouter } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '@/lib/chart-theme'

interface CourseRow {
  title: string
  slug: string
  enrollments: number
  completed: number
  inProgress: number
  notStarted: number
}

function truncate(s: string, n = 22) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function CourseBars({ data }: { data: CourseRow[] }) {
  const c = useChartColors()
  const router = useRouter()

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
        onClick={(state) => {
          const p = (state as unknown as { activePayload?: { payload?: CourseRow }[] }).activePayload
          const slug = p?.[0]?.payload?.slug
          if (slug) router.push(`/dashboard/courses/${slug}`)
        }}
      >
        <CartesianGrid horizontal={false} stroke={c.grid} strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
        <YAxis
          type="category"
          dataKey="title"
          width={130}
          tick={{ fill: c.fg, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => truncate(v)}
        />
        <Tooltip
          cursor={{ fill: c.grid, fillOpacity: 0.3 }}
          contentStyle={{ background: c.card, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.fg, fontSize: 12 }}
        />
        <Bar dataKey="completed" name="Completed" stackId="s" fill={c.completed} radius={[4, 0, 0, 4]} isAnimationActive={false} cursor="pointer" />
        <Bar dataKey="inProgress" name="In progress" stackId="s" fill={c.accent} isAnimationActive={false} cursor="pointer" />
        <Bar dataKey="notStarted" name="Not started" stackId="s" fill={c.notStarted} radius={[0, 4, 4, 0]} isAnimationActive={false} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  )
}
