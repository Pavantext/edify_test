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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MoreHorizontal, Search, UserPlus, CheckCircle2, XCircle, Download } from "lucide-react"
import { format } from "date-fns"

interface WaitlistEntry {
  id: string
  email: string
  created_at: string
  status: "pending" | "invited" | "completed" | "denied"
  account_type: string | null
  approved_at: string | null
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "invited", label: "Invited" },
  { value: "completed", label: "Completed" },
  { value: "denied", label: "Denied" }
]

export default function WaitlistTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWaitlist = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status !== 'all') params.append('status', status);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/waitlist?${params}`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      setEntries(data.data);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, [status, searchQuery]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/waitlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');
      
      fetchWaitlist(); // Refresh the list
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 ring-yellow-600/20",
      invited: "bg-blue-100 text-blue-800 ring-blue-600/20",
      completed: "bg-green-100 text-green-800 ring-green-600/20",
      denied: "bg-red-100 text-red-800 ring-red-600/20"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800 ring-gray-600/20";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[300px]"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Account Type</TableHead>
            <TableHead>Joined At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10">
                Loading...
              </TableCell>
            </TableRow>
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10">
                No entries found
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.email}</TableCell>
                <TableCell>{entry.account_type || "Not selected"}</TableCell>
                <TableCell>
                  {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(entry.status)}`}>
                    {entry.status}
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
                      {entry.status === "pending" && (
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(entry.id, "invited")}
                          className="text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite
                        </DropdownMenuItem>
                      )}
                      {entry.status === "invited" && (
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(entry.id, "completed")}
                          className="text-green-600 focus:text-green-600 focus:bg-green-50"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark as Completed
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(entry.id, "denied")}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Deny
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