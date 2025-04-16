'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { DataTable } from '@/components/dashboard/analytics/tables/data-table'
import { columns } from './columns'
import { User } from "@/types/analytics"
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"

type DatabaseChanges = {
  [key: string]: any
  id: string
}

export function UsersTableShell({ users: initialUsers }: { users: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [searchQuery, setSearchQuery] = useState("")
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const channel = supabase
      .channel('users_realtime')
      .on('system', 
        { event: 'postgres_changes', schema: 'public', table: 'users' },
        async (payload: { new: DatabaseChanges, old: DatabaseChanges, eventType: string }) => {
          if (!payload.new?.id) return

          const { data: updatedUser } = await supabase
            .from('users')
            .select(`
              *,
              org_members!inner (
                role,
                organization:organizations (
                  id,
                  name,
                  slug
                )
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (payload.eventType === 'INSERT') {
            setUsers(prev => [updatedUser, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setUsers(prev => 
              prev.map(user => 
                user.id === payload.new.id ? updatedUser : user
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setUsers(prev => 
              prev.filter(user => user.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const tableColumns = columns.map(col => ({
    ...col,
    cell: (props: any) => {
      const originalCell = typeof col.cell === 'function' 
        ? col.cell(props) 
        : props.getValue();
      return (
        <div 
          onClick={() => router.push(`/admin/analytics/users/${props.row.original.id}`)} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              router.push(`/admin/analytics/users/${props.row.original.id}`);
            }
          }}
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          aria-label={`View details for user ${props.row.original.email || 'Unknown'}`}
        >
          {originalCell}
        </div>
      );
    }
  }));

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const email = user.email?.toLowerCase() || '';
    const username = email.split('@')[0];
    return username.includes(searchLower) || email.includes(searchLower);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <DataTable 
        columns={tableColumns}
        data={filteredUsers}
      />
    </div>
  )
} 