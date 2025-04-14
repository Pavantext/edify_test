"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import useSWR from "swr"

interface ComparisonData {
  name: string
  users: number
  orgs: number
}

interface Props {
  data?: Array<{
    date: string
    input: number
    output: number
    total: number
  }>
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch comparison data')
  return response.json()
}

export function UsageComparisonChart({ data: initialData = [] }: Props) {
  const { data } = useSWR<ComparisonData[]>('/api/analytics/comparison', fetcher, {
    fallbackData: [
      {
        name: "Week 1",
        users: 400,
        orgs: 240,
      },
      {
        name: "Week 2",
        users: 300,
        orgs: 139,
      },
      {
        name: "Week 3",
        users: 200,
        orgs: 980,
      },
      {
        name: "Week 4",
        users: 278,
        orgs: 390,
      },
    ],
    refreshInterval: 30000,
  })

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}k`}
        />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="users"
          name="Individual Users"
          fill="#8884d8"
          radius={[4, 4, 0, 0]}
          stackId="stack"
        />
        <Bar
          dataKey="orgs"
          name="Organizations"
          fill="#82ca9d"
          radius={[4, 4, 0, 0]}
          stackId="stack"
        />
      </BarChart>
    </ResponsiveContainer>
  )
} 