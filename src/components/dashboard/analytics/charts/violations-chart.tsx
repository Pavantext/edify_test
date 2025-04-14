"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts"
import useSWR from "swr"

interface ViolationData {
  name: string
  value: number
}

interface Props {
  data?: Array<{
    name: string
    value: number
  }>
  userId?: string
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#FFD93D', '#6C5B7B', '#C06C84', '#F8B195', '#355C7D']

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch violations data')
  return response.json()
}

const getAbbreviation = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
}

export function ViolationsChart({ data: initialData = [], userId }: Props) {
  const { data } = useSWR<ViolationData[]>(
    userId ? `/api/analytics/violations/${userId}` : null,
    fetcher,
    {
      fallbackData: initialData,
      refreshInterval: 30000,
    }
  )

  const chartData = (data || []).map(item => ({
    ...item,
    shortName: getAbbreviation(item.name),
    fullName: item.name
  }))

  const renderColorfulLegendText = (value: string, entry: any) => {
    return (
      <span 
        style={{ 
          backgroundColor: entry.color,
          color: 'white',
          padding: '5px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '500',
          display: 'inline-block',
          textTransform: 'uppercase',
          cursor: 'pointer',
          margin: '2px'
        }}
        className="instant-tooltip"
      >
        <style jsx global>{`
          .instant-tooltip {
            position: relative;
          }
          .instant-tooltip:hover::before {
            content: "${entry?.payload?.fullName || value}";
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            padding: 4px 8px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
          }
        `}</style>
        {entry?.payload?.shortName || value}
      </span>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="shortName"
          cx="50%"
          cy="50%"
          outerRadius={120}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value, name, entry) => [
            `${value} violations`,
            (entry?.payload as any)?.fullName || name
          ]}
          wrapperStyle={{ opacity: 1 }}
          contentStyle={{ 
            background: 'rgba(0, 0, 0, 0.8)',
            border: 'none',
            borderRadius: '4px',
            padding: '8px'
          }}
          itemStyle={{ color: 'white' }}
        />
        <Legend 
          iconSize={0}
          formatter={renderColorfulLegendText}
          wrapperStyle={{ 
            fontSize: '12px',
            padding: '16px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
} 