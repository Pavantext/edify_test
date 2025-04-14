// src/app/(dashboard)/admin/analytics/organizations/page.tsx
"use client"

import useSWR from "swr"
import { OrganizationsTableShell } from "@/app/(dashboard)/admin/analytics/organizations/table-shell"
import { Skeleton } from "@/components/ui/skeleton"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch organizations')
  return res.json()
}

export default function OrganizationsPage() {
  const { data: organizations, error, isLoading } = useSWR('/api/analytics/organizations', fetcher, {
    refreshInterval: 50000,
    revalidateOnFocus: true,
  })

  if (error) return <div>Failed to load organisations</div>
  if (isLoading) return <Skeleton className="w-full h-[500px]" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Organisations</h1>
      </div>
      <OrganizationsTableShell organizations={organizations || []} />
    </div>
  )
}