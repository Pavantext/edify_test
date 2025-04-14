// src/components/dashboard/analytics/tables/user-table-row.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User } from "lucide-react"
import { TableCell, TableRow } from "@/components/ui/table"

interface UserTableRowProps {
  user: {
    id: string
    email: string
    image_url: string | null
    total_tokens: number
    total_cost: number
    violations: number
  }
  role: string
  onClick?: () => void
}

export function UserTableRow({ user, role, onClick }: UserTableRowProps) {
  const username = user.email.split('@')[0]
  
  return (
    <tr className="border-b transition-colors hover:bg-muted/50 cursor-pointer" onClick={(e) => {
      e.stopPropagation()
      onClick?.()
    }}>
      <td className="w-[50px] p-4"></td>
      <td className="p-4 w-[400px]">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image_url || undefined} alt={username} />
            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{username}</span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </div>
        </div>
      </td>
      <td className="p-4 w-[150px]"><Badge variant="outline">{role}</Badge></td>
      <td className="p-4 w-[200px] text-right">{user.total_tokens.toLocaleString()}</td>
      <td className="p-4 w-[150px] text-right">£{user.total_cost.toFixed(2)}</td>
      <td className="p-4 w-[150px] text-center">
        <Badge variant={user.violations > 0 ? "destructive" : "secondary"}>{user.violations}</Badge>
      </td>
    </tr>
  )
}