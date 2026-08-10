'use client'

import { useRouter } from 'next/navigation'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartColors } from '@/lib/chart-theme'

interface MemberRow {
  id: string
  fullName: string | null
  email: string
  avgProgress: number
  completedCourses: number
  courseCount: number
  overdueMandatory: number
}

function truncate(s: string, n = 16) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function MemberBars({ members }: { members: MemberRow[] }) {
  const c = useChartColors()
  const router = useRouter()

  // At-risk (overdue / lowest progress) float to the top.
  const data = [...members]
    .map((m) => ({ ...m, name: m.fullName ?? m.email }))
    .sort((a, b) => a.avgProgress - b.avgProgress)

  const colorFor = (m: MemberRow) =>
    m.overdueMandatory > 0 ? c.overdue : m.avgProgress >= 100 ? c.completed : c.accent

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 40, bottom: 0, left: 8 }}
        onClick={(state) => {
          const p = (state as unknown as { activePayload?: { payload?: { id?: string } }[] }).activePayload
          const id = p?.[0]?.payload?.id
          if (id) router.push(`/dashboard/users/${id}`)
        }}
      >
        <XAxis type="number" domain={[0, 100]} tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} unit="%" />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fill: c.fg, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => truncate(v)}
        />
        <Tooltip
          cursor={{ fill: c.grid, fillOpacity: 0.3 }}
          formatter={(value, _name, item) => {
            const m = (item?.payload ?? {}) as MemberRow
            const v = Number(value) || 0
            return [`${v}% · ${m.completedCourses}/${m.courseCount} done`, 'Progress']
          }}
          contentStyle={{ background: c.card, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.fg, fontSize: 12 }}
        />
        <Bar dataKey="avgProgress" radius={[0, 4, 4, 0]} isAnimationActive={false} cursor="pointer">
          {data.map((m) => (
            <Cell key={m.id} fill={colorFor(m)} />
          ))}
          <LabelList
            dataKey="overdueMandatory"
            position="right"
            formatter={(value) => {
              const n = Number(value) || 0
              return n > 0 ? `⚠ ${n}` : ''
            }}
            style={{ fill: c.overdue, fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
