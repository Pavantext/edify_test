// src/app/(dashboard)/admin/analytics/organizations/table-shell.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { DataTable } from '@/components/ui/data-table'
import { columns } from './columns'
import { useRouter } from 'next/navigation'
import { UserTableRow } from '@/components/dashboard/analytics/tables/user-table-row'

interface Organization {
  id: string
  name: string
  slug: string
  image_url: string | null
  created_at: string
  total_tokens: number
  total_cost: number
  violations: number
  org_members: Array<{
    role: string
    user: {
      id: string
      email: string
      image_url: string | null
      total_tokens: number
      total_cost: number
      violations: number
    }
  }>
}

export function OrganizationsTableShell({ organizations: initialOrgs }: { organizations: Organization[] }) {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrgs)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const channel = supabase
      .channel('organizations_realtime')
      .on('system', 
        { event: 'postgres_changes', schema: 'public', table: 'organizations' },
        async (payload) => {
          if (!payload.new?.id) return

          // Fetch updated organization with member metrics
          const { data: updatedOrg } = await supabase
            .from('organizations')
            .select(`
              *,
              org_members (
                role,
                user:users (
                  id,
                  email,
                  image_url
                )
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!updatedOrg) return

          // Fetch metrics for org members
          const userIds = updatedOrg.org_members.map((member: { user: { id: string } }) => member.user.id)
          const { data: metrics } = await supabase
            .from('ai_tools_metrics')
            .select('user_id, total_tokens, price_gbp, content_flags')
            .in('user_id', userIds)

          // Calculate metrics for each user
          const updatedMembers = updatedOrg.org_members.map((member: { 
            role: string;
            user: { id: string; email: string; image_url: string | null; }
          }) => ({
            ...member,
            user: {
              ...member.user,
              total_tokens: metrics?.filter(m => m.user_id === member.user.id)?.reduce((sum: number, m) => sum + (m.total_tokens || 0), 0) || 0,
              total_cost: metrics?.filter(m => m.user_id === member.user.id)?.reduce((sum: number, m) => sum + (Number(m.price_gbp) || 0), 0) || 0,
              violations: metrics?.filter(m => m.user_id === member.user.id)?.filter(m => m.content_flags?.content_violation)?.length || 0
            }
          }))

          // Calculate organization totals
          const orgMetrics = {
            total_tokens: updatedMembers.reduce((sum: number, member: { user: { total_tokens: number } }) => sum + member.user.total_tokens, 0),
            total_cost: updatedMembers.reduce((sum: number, member: { user: { total_cost: number } }) => sum + member.user.total_cost, 0),
            violations: updatedMembers.reduce((sum: number, member: { user: { violations: number } }) => sum + member.user.violations, 0)
          }

          const finalUpdatedOrg = {
            ...updatedOrg,
            ...orgMetrics,
            org_members: updatedMembers
          }

          if (payload.eventType === 'INSERT') {
            setOrganizations(prev => [finalUpdatedOrg, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setOrganizations(prev => 
              prev.map(org => 
                org.id === payload.new.id ? finalUpdatedOrg : org
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setOrganizations(prev => 
              prev.filter(org => org.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <DataTable 
      columns={columns}
      data={organizations}
      renderSubComponent={({ row }) => (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Team Members</h3>
          <div className="space-y-2">
            {row.original.org_members.map((member) => (
              <UserTableRow 
                key={member.user.id}
                user={member.user}
                role={member.role}
                onClick={() => router.push(`/admin/analytics/users/${member.user.id}`)}
              />
            ))}
          </div>
        </div>
      )}
      getRowCanExpand={() => true}
      onRowClick={(row) => router.push(`/admin/analytics/organizations/${row.original.id}`)}
    />
  )
}