import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { TokenUsageChart } from "@/components/dashboard/analytics/charts/token-usage-chart"
import { CostDistributionChart } from "@/components/dashboard/analytics/charts/cost-distribution-chart"
import { ViolationsChart } from "@/components/dashboard/analytics/charts/violations-chart"
import { MetricCard } from "@/components/dashboard/analytics/metrics/metric-card"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { CircleDollarSign, Activity, AlertTriangle, Blocks } from "lucide-react"
import { NextRequest } from 'next/server'

type RouteParams = {
  params: Promise<{
    userId: string
  }>
}

export default async function UserAnalytics({ params }: RouteParams) {
  const { userId } = await params
  const supabase = await createClient()
  
  // Updated query to use left join instead of inner join
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      *,
      org_members (
        role,
        organization:organizations (
          id,
          name,
          slug
        )
      )
    `)
    .eq('id', userId)
    .single()

  if (error || !user) {
    return notFound()
  }

  // Fetch user metrics
  const { data: metrics } = await supabase
    .from('user_metrics')
    .select('*')
    .eq('user_id', userId)
    .single()

  const username = user.email.split('@')[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{username}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <DateRangePicker />
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tokens"
          value={metrics?.total_tokens?.toLocaleString() ?? '0'}
          icon={<Blocks className="h-4 w-4 text-muted-foreground" />}
          trend={{
            value: `${metrics?.token_growth ?? 0}% from last month`,
            positive: (metrics?.token_growth ?? 0) > 0
          }}
        />
        <MetricCard
          title="Total Cost"
          value={`£${metrics?.total_cost?.toFixed(2) ?? '0.00'}`}
          icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
          trend={{
            value: `${metrics?.cost_growth ?? 0}% from last month`,
            positive: (metrics?.cost_growth ?? 0) > 0
          }}
        />
        <MetricCard
          title="Organizations"
          value={(user.org_members?.length || 0).toString()}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Violations"
          value={(metrics?.violations_count ?? 0).toString()}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          description="Last 30 days"
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="usage" className="space-y-4">
          <Card className="p-6">
            <TokenUsageChart userId={userId} />
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="space-y-4">
          <Card className="p-6">
            <CostDistributionChart data={metrics?.cost_distribution || []} />
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <Card className="p-6">
            <ViolationsChart userId={userId} />
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <RecentActivity userId={userId} />
      </Card>
    </div>
  )
} 