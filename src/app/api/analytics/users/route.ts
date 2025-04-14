import { createServiceClient } from "@/utils/supabase/service"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createServiceClient()

  try {
    // Fetch users with their organizations and metrics
    const { data: users, error } = await supabase
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
        ),
        chat_metrics!chat_metrics_user_id_fkey (
          input_tokens,
          output_tokens,
          total_tokens,
          price_gbp,
          content_flags
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Process users to aggregate their metrics
    const processedUsers = users.map(user => {
      const metrics = user.chat_metrics || []
      const totalTokens = metrics.reduce((sum: number, m: { total_tokens?: number }) => 
        sum + (m.total_tokens || 0), 0)
      const totalCost = metrics.reduce((sum: number, m: { price_gbp?: number }) => 
        sum + (Number(m.price_gbp) || 0), 0)
      const contentViolations = metrics.reduce((sum: number, m: { content_flags?: Record<string, boolean> }) => {
        const flags = m.content_flags || {}
        return sum + Object.values(flags).filter(Boolean).length
      }, 0)

      delete user.chat_metrics // Remove raw metrics data
      return {
        ...user,
        total_tokens: totalTokens,
        total_cost: totalCost,
        violations: contentViolations
      }
    })

    return NextResponse.json(processedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
} 