// src/app/(dashboard)/admin/analytics/organizations/columns.tsx
"use client"

import { ColumnDef } from "@tanstack/table-core"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, Building, ChevronDown, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

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

export const columns: ColumnDef<Organization>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
        >
          {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      ) : null
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Organisation
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const org = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={org.image_url || undefined} alt={org.name} />
            <AvatarFallback className="bg-primary/10">
              <Building className="h-4 w-4 text-primary" />
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{org.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return new Date(row.original.created_at).toLocaleDateString()
    },
  },
  {
    accessorKey: "total_tokens",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total Tokens
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const value = row.getValue("total_tokens") as number
      return <div>{value.toLocaleString()}</div>
    },
  },
  {
    accessorKey: "total_cost",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Total Cost
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const value = row.getValue("total_cost") as number
      return <div>£{value.toFixed(2)}</div>
    },
  },
  {
    accessorKey: "violations",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Violations
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const violations = row.getValue("violations") as number
      return (
        <Badge variant={violations > 0 ? "destructive" : "secondary"}>
          {violations}
        </Badge>
      )
    },
  },
]