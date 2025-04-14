import { createClient } from "@supabase/supabase-js"

interface AnalyticsData {
  totals: {
    total_input_tokens: number
    total_output_tokens: number
    total_tokens: number
    total_cost: number
    total_requests: number
  } | null
  violationsCount: number
  usersCount: number | null
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    // Get total tokens and cost for last 30 days
    const { data: totals, error: totalsError } = await supabase
      .from('chat_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .then(({ data }) => ({
        data: {
          total_input_tokens: data?.reduce((sum, row) => sum + row.input_tokens, 0) || 0,
          total_output_tokens: data?.reduce((sum, row) => sum + row.output_tokens, 0) || 0,
          total_tokens: data?.reduce((sum, row) => sum + row.total_tokens, 0) || 0,
          total_cost: data?.reduce((sum, row) => sum + Number(row.price_gbp), 0) || 0,
          total_requests: data?.length || 0
        },
        error: null
      }))

    if (totalsError) throw totalsError

    // Get violations count
    const { data: violations, error: violationsError } = await supabase
      .from('chat_metrics')
      .select('content_flags')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (violationsError) throw violationsError

    const violationsCount = violations?.reduce((acc, curr) => {
      Object.values(curr.content_flags).forEach(value => {
        if (value === true) acc++
      })
      return acc
    }, 0) || 0

    // Get unique users count
    const { count: usersCount, error: usersError } = await supabase
      .from('chat_metrics')
      .select('user_id', { count: 'exact', head: true })
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (usersError) throw usersError

    return {
      totals,
      violationsCount,
      usersCount
    }
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return {
      totals: null,
      violationsCount: 0,
      usersCount: null
    }
  }
} 