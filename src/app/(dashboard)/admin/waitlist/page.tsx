"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WaitlistTable from "@/components/waitlist/waitlist-table"
import InvitationsTable from "@/components/waitlist/invitations-table"
import OrgRequestsTable from "@/components/waitlist/org-requests-table"
import { UsersRound, UserPlus, Building2 } from "lucide-react"

export default function WaitlistDashboard() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header Section */}
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <h1 className="text-3xl font-semibold tracking-tight">Waitlist Management</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage waitlist applications, invitations, and organisation requests
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 py-8">
        <div className="max-w-6xl mx-auto px-8">
          <Tabs defaultValue="waitlist" className="w-full space-y-6">
            <TabsList className="w-[600px]">
              <TabsTrigger value="waitlist" className="flex-1 flex items-center justify-center gap-2">
                <UsersRound className="h-4 w-4" />
                <span>Waitlist</span>
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex-1 flex items-center justify-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span>Invitations</span>
              </TabsTrigger>
              <TabsTrigger value="org-requests" className="flex-1 flex items-center justify-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Organisation Requests</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="waitlist" className="m-0">
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="p-8">
                  <WaitlistTable />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="invitations" className="m-0">
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="p-8">
                  <InvitationsTable />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="org-requests" className="m-0">
              <div className="rounded-lg border bg-card shadow-sm">
                <div className="p-8">
                  <OrgRequestsTable />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
} 