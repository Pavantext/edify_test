"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import useSWR from "swr"

interface TimeSeriesData {
  date: string
  input: number
  output: number
  total: number
}

interface Props {
  data?: TimeSeriesData[]
  userId?: string
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch token usage data')
  return response.json()
}

export function TokenUsageChart({ data: initialData = [], userId }: Props) {
  const { data } = useSWR<TimeSeriesData[]>(
    userId ? `/api/analytics/tokens/${userId}` : null,
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: 30000,
    }
  )

  const chartData = data || Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toLocaleDateString(),
      input: 0,
      output: 0,
      total: 0
    }
  })

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="input" stroke="#8884d8" name="Input Tokens" />
        <Line type="monotone" dataKey="output" stroke="#82ca9d" name="Output Tokens" />
        <Line type="monotone" dataKey="total" stroke="#ffc658" name="Total Tokens" />
      </LineChart>
    </ResponsiveContainer>
  )
} 