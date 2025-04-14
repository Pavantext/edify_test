"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"

interface Activity {
  id: string
  action: string
  created_at: string
  metadata?: any
}

interface Props {
  userId?: string
  limit?: number
}

export function RecentActivity({ userId, limit = 5 }: Props) {
  const [activities, setActivities] = useState<Activity[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function fetchActivities() {
      const query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (userId) {
        query.eq('user_id', userId)
      }

      const { data } = await query
      setActivities(data || [])
    }

    fetchActivities()
  }, [userId, limit, supabase])

  return (
    <div className="space-y-8">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage src={activity.metadata?.image_url} alt="Avatar" />
            <AvatarFallback>
              {activity.metadata?.name?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">
              {activity.metadata?.name || 'User'}
            </p>
            <p className="text-sm text-muted-foreground">
              {activity.action}
            </p>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </div>
        </div>
      ))}
    </div>
  )
} 