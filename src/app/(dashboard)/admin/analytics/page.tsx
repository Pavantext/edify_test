"use client"

import { useState } from "react"
import useSWR from "swr"
import { MetricCard } from "@/components/dashboard/analytics/metrics/metric-card"
import { TokenUsageChart } from "@/components/dashboard/analytics/charts/token-usage-chart"
import { CostDistributionChart } from "@/components/dashboard/analytics/charts/cost-distribution-chart"
import { ViolationsChart } from "@/components/dashboard/analytics/charts/violations-chart"
import { UsageComparisonChart } from "@/components/dashboard/analytics/charts/usage-comparison-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AnalyticsData {
  totals: {
    total_input_tokens: number
    total_output_tokens: number
    total_tokens: number
    total_cost: number
    total_requests: number
    total_violations?: number
    total_users?: number
  }
  timeSeriesData: any[] // Will add specific type once we have the data structure
  modelData: any[]
  violationsData: any[]
  costDistributionData: Array<{ name: string; cost: number }>
}

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch analytics data')
  }
  return response.json()
}

export default function AnalyticsDashboard() {
  const { data, error, isLoading } = useSWR<AnalyticsData>('/api/analytics', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true,
  })

  if (error) return <div>Failed to load analytics data</div>
  if (isLoading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={data?.totals?.total_users?.toString() || "0"}
        />
        <MetricCard
          title="Total Tokens"
          value={`${((data?.totals?.total_tokens || 0) / 1000000).toFixed(1)}M`}
        />
        <MetricCard
          title="Total Cost"
          value={`£${(data?.totals?.total_cost || 0).toFixed(2)}`}
        />
        <MetricCard
          title="Total Violations"
          value={data?.totals?.total_violations?.toString() || "0"}
        />
      </div>

      {/* Main Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Token Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <TokenUsageChart data={data?.timeSeriesData} />
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Cost Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <CostDistributionChart data={data?.costDistributionData} />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Total Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <ViolationsChart data={data?.violationsData} />
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Usage Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageComparisonChart data={data?.timeSeriesData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 