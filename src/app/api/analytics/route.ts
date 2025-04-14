import { createServiceClient } from "@/utils/supabase/service"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    console.log('Fetching analytics data from ai_tools_metrics...')
    
    // Get all metrics for the last 30 days from ai_tools_metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('ai_tools_metrics')
      .select('*')
      .gte('timestamp', thirtyDaysAgo)

    if (metricsError) {
      console.error('Supabase query error:', metricsError)
      throw metricsError
    }

    console.log(`Found ${metrics?.length || 0} records`)

    // Calculate violations using the flagged field and content_flags
    const totalViolations = metrics?.reduce((sum, row) => {
      if (!row.content_flags) return sum;
      const flags = row.content_flags as Record<string, boolean>;
      return sum + Object.values(flags).filter(Boolean).length;
    }, 0) || 0;

    // Format date consistently
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    // Group by date with token metrics
    const timeSeriesData = metrics?.reduce((acc, curr) => {
      const date = formatDate(new Date(curr.timestamp))
      if (!acc[date]) {
        acc[date] = { 
          date, 
          input: 0, 
          output: 0, 
          total: 0,
          cost: 0,
          requests: 0 
        }
      }
      acc[date].input += curr.input_tokens || 0
      acc[date].output += curr.output_tokens || 0
      acc[date].total += curr.total_tokens || 0
      acc[date].cost += Number(curr.price_gbp) || 0
      acc[date].requests += 1
      return acc
    }, {} as Record<string, any>)

    // Group by model with detailed metrics
    const modelData = metrics?.reduce((acc, curr) => {
      const model = curr.model || 'unknown'
      if (!acc[model]) {
        acc[model] = { 
          name: model, 
          cost: 0, 
          tokens: 0,
          requests: 0,
          violations: 0
        }
      }
      acc[model].cost += Number(curr.price_gbp) || 0
      acc[model].tokens += curr.total_tokens || 0
      acc[model].requests += 1
      acc[model].violations += curr.flagged ? 1 : 0
      return acc
    }, {} as Record<string, any>)

    // Group by prompt type with cost metrics
    const costDistributionData = metrics?.reduce((acc, curr) => {
      const toolName = curr.tool_name || curr.prompt_type || 'other'
      if (!acc[toolName]) {
        acc[toolName] = { 
          name: toolName, 
          cost: 0
        }
      }
      acc[toolName].cost += Number(curr.price_gbp) || 0
      return acc
    }, {} as Record<string, { name: string; cost: number }>)

    // Group by prompt type
    const promptTypeData = metrics?.reduce((acc, curr) => {
      const type = curr.prompt_type || 'unknown'
      if (!acc[type]) {
        acc[type] = {
          name: type,
          count: 0,
          tokens: 0,
          cost: 0,
          violations: 0
        }
      }
      acc[type].count += 1
      acc[type].tokens += curr.total_tokens || 0
      acc[type].cost += Number(curr.price_gbp) || 0
      acc[type].violations += curr.flagged ? 1 : 0
      return acc
    }, {} as Record<string, any>)

    // Get unique users count
    const { count: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersError) {
      console.error('Users count error:', usersError)
      throw usersError
    }

    // Calculate violations by type
    const violationsData = metrics?.reduce((acc, curr) => {
      const flags = curr.content_flags as Record<string, boolean>
      Object.entries(flags).forEach(([key, value]) => {
        if (value) {
          const name = key.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')
          acc[key] = (acc[key] || { name, value: 0 })
          acc[key].value += 1
        }
      })
      return acc
    }, {} as Record<string, any>)

    const response = {
      totals: {
        total_input_tokens: metrics?.reduce((sum, row) => sum + (row.input_tokens || 0), 0) || 0,
        total_output_tokens: metrics?.reduce((sum, row) => sum + (row.output_tokens || 0), 0) || 0,
        total_tokens: metrics?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0,
        total_cost: metrics?.reduce((sum, row) => sum + (Number(row.price_gbp) || 0), 0) || 0,
        total_requests: metrics?.length || 0,
        total_users: totalUsers || 0,
        total_violations: totalViolations
      },
      timeSeriesData: Object.values(timeSeriesData || {}),
      modelData: Object.values(modelData || {}),
      promptTypeData: Object.values(promptTypeData || {}),
      costDistributionData: Object.values(costDistributionData || {}),
      violationsData: (Object.values(violationsData || {}) as Array<{ name: string; value: number }>).filter(v => v.value > 0)
    }

    console.log('Analytics response:', JSON.stringify(response, null, 2))
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in analytics API:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
} 