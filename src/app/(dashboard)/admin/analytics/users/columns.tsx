"use client"

import { ColumnDef } from "@tanstack/table-core"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, User as UserIcon, Check, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User } from "@/types/analytics"
import useSWR from "swr"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

const subscriptionFetcher = async (userId: string) => {
  const res = await fetch(`/api/analytics/users/${userId}/premium`)
  if (!res.ok) throw new Error('Failed to fetch subscription status')
  return res.json()
}

const toggleSubscription = async (userId: string, premium: boolean) => {
  const res = await fetch(`/api/analytics/users/${userId}/premium`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ premium }),
  })
  if (!res.ok) {
    const error = await res.text()
    throw new Error(error || 'Failed to update subscription status')
  }
  return res.json()
}

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const user = row.original
      const email = user.email || ''
      const username = email.split('@')[0]
      
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image_url || undefined} alt={username} />
            <AvatarFallback className="bg-primary/10">
              <UserIcon className="h-4 w-4 text-primary" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{username}</span>
            <span className="text-sm text-muted-foreground">{email}</span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "organizations",
    header: "Organizations",
    cell: ({ row }) => {
      const orgs = row.original.org_members || []
      if (orgs.length === 0) {
        return <span className="text-muted-foreground text-sm">No organisations</span>
      }
      return (
        <div className="flex flex-wrap gap-1">
          {orgs.slice(0, 2).map((org) => (
            <Badge key={org.organization.id} variant="secondary">
             {org.organization.name.split('_')[0]}
            </Badge>
          ))}
          {orgs.length > 2 && (
            <Badge variant="secondary">+{orgs.length - 2} more</Badge>
          )}
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
          Joined
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
  {
    accessorKey: "subscription",
    header: "Subscription",
    cell: ({ row }) => {
      const userId = row.original.id
      const { data, mutate } = useSWR(`subscription-${userId}`, () => subscriptionFetcher(userId))
      
      const handleToggle = async () => {
        try {
          const newStatus = !data?.premium
          // Optimistically update the UI first
          await mutate({ premium: newStatus }, false)
          
          // Make the API call
          const result = await toggleSubscription(userId, newStatus)
          
          // Update with the actual server response
          await mutate({ premium: result.premium }, false)
          
          toast.success(`Subscription ${newStatus ? 'activated' : 'deactivated'} successfully`)
        } catch (error) {
          // Revert the optimistic update on error
          await mutate()
          console.error('Failed to toggle subscription:', error)
          toast.error(error instanceof Error ? error.message : 'Failed to update subscription')
        }
      }

      return (
        <div className="flex items-center gap-2">
          <Badge variant={data?.premium ? "default" : "secondary"}>
            {data?.premium ? "Active" : "Inactive"}
          </Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant={data?.premium ? "destructive" : "default"}
                size="sm"
                className="h-7 transition-colors duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {data?.premium ? (
                  <>
                    <X className="mr-1 h-3 w-3" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Activate
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {data?.premium ? 'Deactivate Subscription' : 'Activate Subscription'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to {data?.premium ? 'deactivate' : 'activate'} this user's subscription?
                  {data?.premium ? ' They will lose access to premium features.' : ' They will gain access to premium features.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleToggle}>
                  {data?.premium ? 'Deactivate' : 'Activate'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )
    },
  },
] 