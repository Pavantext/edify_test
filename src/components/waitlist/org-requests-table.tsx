"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, MoreHorizontal, CheckCircle2, XCircle, Building2 } from "lucide-react"
import { WaitlistEntry } from '@/types/waitlist'
import { toast } from "sonner"

export default function OrgRequestsTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrgRequests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('account_type', 'organization')
      params.append('org_status', 'pending')
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/admin/waitlist?${params}`)
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error)
      setEntries(data.data)
    } catch (error) {
      console.error('Error fetching org requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrgRequests()
  }, [searchQuery])

  const handleOrgStatusChange = async (entry: WaitlistEntry, newStatus: string) => {
    try {
      console.log('Starting org status update:', { entry, newStatus });
      
      const response = await fetch(`/api/admin/waitlist/${entry.id}/org-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_status: newStatus })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        toast.error("Failed to update organization status");
        throw new Error('Failed to update organization status');
      }

      const data = await response.json();
      console.log('Success response:', data);
      toast.success("Organization status updated successfully");

      fetchOrgRequests();
    } catch (error) {
      console.error('Error in handleOrgStatusChange:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search organisations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[300px]"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organisation Name</TableHead>
            <TableHead>Owner Email</TableHead>
            <TableHead>Requested At</TableHead>
            <TableHead>User Status</TableHead>
            <TableHead>Org Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10">
                Loading...
              </TableCell>
            </TableRow>
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10">
                No pending organisation requests
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.organization_name}</TableCell>
                <TableCell>{entry.email}</TableCell>
                <TableCell>{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(entry.org_status)}`}>
                    {entry.org_status}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => handleOrgStatusChange(entry, "approved")}
                        className={`${entry.status === "completed" 
                          ? "text-green-600" 
                          : "text-gray-400 cursor-not-allowed"}`}
                        disabled={entry.status !== "completed"}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {entry.status === "completed" 
                          ? "Approve Organisation" 
                          : "Complete User Status First"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleOrgStatusChange(entry, "denied")}
                        className="text-red-600"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Deny Request
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function getStatusColor(status: string | null) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800 ring-yellow-600/20",
    invited: "bg-blue-100 text-blue-800 ring-blue-600/20",
    approved: "bg-green-100 text-green-800 ring-green-600/20",
    completed: "bg-purple-100 text-purple-800 ring-purple-600/20",
    denied: "bg-red-100 text-red-800 ring-red-600/20"
  };
  return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800 ring-gray-600/20";
} 