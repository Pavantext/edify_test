"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

interface CostData {
  name: string
  cost: number
}

interface Props {
  data?: Array<CostData>
}

export function CostDistributionChart({ data = [] }: Props) {
  console.log('Cost Distribution Data:', data)
  
  // Sort data by cost in descending order and filter out empty costs
  const sortedData = [...data]
    .filter(item => item.cost > 0)
    .sort((a, b) => b.cost - a.cost)

  console.log('Sorted Data:', sortedData)

  const formatName = (name: string) => {
    // Handle special cases
    if (name === 'edify_chat') return 'Edify Chat'
    if (name === 'other') return 'Other'
    
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart 
        data={sortedData}
        margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
      >
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={100}
          tickFormatter={formatName}
        />
        <YAxis 
          tickFormatter={(value) => `£${value.toFixed(2)}`}
        />
        <Tooltip 
          formatter={(value: number) => [`£${value.toFixed(2)}`, "Cost"]}
          labelFormatter={formatName}
        />
        <Legend />
        <Bar 
          dataKey="cost" 
          fill="#8884d8" 
          name="Cost (£)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
} 