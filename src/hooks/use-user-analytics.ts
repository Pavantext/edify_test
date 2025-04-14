import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { UserAnalytics, ChatMetrics } from '@/types/analytics'

const supabase = createClient()

interface TimeSeriesDataPoint {
  date: string
  input: number
  output: number
  total: number
}

interface ModelDataPoint {
  name: string
  cost: number
  tokens: number
}

interface ViolationDataPoint {
  name: string
  value: number
  fullName: string
}

interface UserAnalyticsData {
  user: UserAnalytics
  metrics: {
    total_tokens: number
    total_cost: number
    violations_count: number
    token_growth: number
    cost_growth: number
  }
  timeSeriesData: TimeSeriesDataPoint[]
  modelData: ModelDataPoint[]
  violationsData: ViolationDataPoint[]
}

async function fetchUserAnalytics(userId: string): Promise<UserAnalyticsData> {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const [userResponse, metricsResponse, previousMetricsResponse] = await Promise.all([
      supabase.from('users')
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
        .single(),
        
      supabase.from('chat_metrics')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', thirtyDaysAgo.toISOString()),
        
      supabase.from('chat_metrics')
        .select('*')
        .eq('user_id', userId)
        .lt('timestamp', thirtyDaysAgo.toISOString())
        .gte('timestamp', new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ])

    if (userResponse.error) throw new Error(userResponse.error.message)
    if (metricsResponse.error) throw new Error(metricsResponse.error.message)
    if (previousMetricsResponse.error) throw new Error(previousMetricsResponse.error.message)

    const user = userResponse.data
    const chatMetrics = metricsResponse.data || []
    const previousMonthMetrics = previousMetricsResponse.data || []

    // Calculate metrics
    const metrics = {
      total_tokens: chatMetrics.reduce((sum, m) => sum + (m.total_tokens || 0), 0),
      total_cost: chatMetrics.reduce((sum, m) => sum + (Number(m.price_gbp) || 0), 0),
      violations_count: chatMetrics.reduce((sum, m) => {
        const flags = m.content_flags as ChatMetrics['content_flags']
        return sum + Object.values(flags).filter(Boolean).length
      }, 0),
      token_growth: 0,
      cost_growth: 0
    }

    // Calculate growth percentages
    const prevTokens = previousMonthMetrics.reduce((sum, m) => sum + (m.total_tokens || 0), 0)
    const prevCost = previousMonthMetrics.reduce((sum, m) => sum + (Number(m.price_gbp) || 0), 0)
    
    metrics.token_growth = prevTokens ? ((metrics.total_tokens - prevTokens) / prevTokens) * 100 : 0
    metrics.cost_growth = prevCost ? ((metrics.total_cost - prevCost) / prevCost) * 100 : 0

    // Process time series data
    const timeSeriesData = Object.values(chatMetrics.reduce((acc: Record<string, TimeSeriesDataPoint>, curr) => {
      const date = new Date(curr.timestamp).toLocaleDateString()
      if (!acc[date]) {
        acc[date] = { date, input: 0, output: 0, total: 0 }
      }
      acc[date].input += curr.input_tokens || 0
      acc[date].output += curr.output_tokens || 0
      acc[date].total += curr.total_tokens || 0
      return acc
    }, {}))

    // Process model data
    const modelData = Object.values(chatMetrics.reduce((acc: Record<string, ModelDataPoint>, curr) => {
      const model = curr.model || 'unknown'
      if (!acc[model]) {
        acc[model] = { name: model, cost: 0, tokens: 0 }
      }
      acc[model].cost += Number(curr.price_gbp) || 0
      acc[model].tokens += curr.total_tokens || 0
      return acc
    }, {}))

    // Process violations data
    const violationsData = Object.entries(chatMetrics.reduce((acc: Record<string, number>, metric) => {
      const flags = metric.content_flags as ChatMetrics['content_flags']
      Object.entries(flags).forEach(([key, value]) => {
        if (value) {
          acc[key] = (acc[key] || 0) + 1
        }
      })
      return acc
    }, {})).map(([key, value]) => ({
      name: key,
      value: Number(value),
      fullName: key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }))

    return {
      user,
      metrics,
      timeSeriesData,
      modelData,
      violationsData
    }
  } catch (error) {
    console.error('Error fetching user analytics:', error)
    throw error
  }
}

export function useUserAnalytics(userId: string) {
  return useSWR<UserAnalyticsData, Error>(
    userId ? `/api/analytics/user/${userId}` : null,
    fetchUserAnalytics,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
      errorRetryCount: 3
    }
  )
} 