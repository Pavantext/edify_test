// src/app/api/analytics/organizations/route.ts
import { createServiceClient } from "@/utils/supabase/service"
import { NextResponse } from "next/server"

interface OrgMember {
  role: string;
  user: {
    id: string;
    email: string;
    image_url: string | null;
  }
}

export async function GET() {
  const supabase = createServiceClient()

  try {
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select(`
        *,
        org_members!inner (
          role,
          user:users!inner (
            id,
            email,
            image_url
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch metrics for each organization's members
    const orgsWithMetrics = await Promise.all(
      organizations.map(async (org) => {
        const userIds = org.org_members.map((member: OrgMember) => member.user.id)
        
        const { data: metrics, error: metricsError } = await supabase
          .from('ai_tools_metrics')
          .select('user_id, total_tokens, price_gbp, content_flags')
          .in('user_id', userIds)

        if (metricsError) throw metricsError

        // Calculate aggregated metrics
        const aggregatedMetrics = metrics?.reduce((acc, metric) => {
          acc.total_tokens += metric.total_tokens || 0
          acc.total_cost += Number(metric.price_gbp) || 0
          acc.violations += metric.content_flags?.content_violation ? 1 : 0
          return acc
        }, { total_tokens: 0, total_cost: 0, violations: 0 })

        // Add metrics to each user in org_members
        const updatedMembers = org.org_members.map((member: OrgMember) => ({
          ...member,
          user: {
            ...member.user,
            total_tokens: metrics
              ?.filter(m => m.user_id === member.user.id)
              ?.reduce((sum, m) => sum + (m.total_tokens || 0), 0) || 0,
            total_cost: metrics
              ?.filter(m => m.user_id === member.user.id)
              ?.reduce((sum, m) => sum + (Number(m.price_gbp) || 0), 0) || 0,
            violations: metrics
              ?.filter(m => m.user_id === member.user.id)
              ?.filter(m => m.content_flags?.content_violation)?.length || 0
          }
        }))

        return {
          ...org,
          org_members: updatedMembers,
          total_tokens: aggregatedMetrics.total_tokens,
          total_cost: aggregatedMetrics.total_cost,
          violations: aggregatedMetrics.violations
        }
      })
    )

    return NextResponse.json(orgsWithMetrics)
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}