// src/app/(dashboard)/admin/analytics/users/page.tsx
"use client"

import useSWR from "swr"
import { UsersTableShell } from "./table-shell"
import { Skeleton } from "@/components/ui/skeleton"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

export default function UsersPage() {
  const { data: users, error, isLoading } = useSWR('/api/analytics/users', fetcher, {
    refreshInterval: 50000, // Refresh every 30 seconds
    revalidateOnFocus: true,
  })

  if (error) return <div>Failed to load users</div>
  if (isLoading) return <Skeleton className="w-full h-[500px]" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
      </div>
      <UsersTableShell users={users || []} />
    </div>
  )
}