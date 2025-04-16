"use client";

import { useOrganization } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

export function OrganizationProfile() {
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded || !organization) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="space-y-6">
        <div>
          <label htmlFor="organization-id" className="text-sm font-medium text-muted-foreground">Organisation ID</label>
          <div className="flex items-center gap-2">
            <p id="organization-id" className="font-mono">{organization.id}</p>
            <Button variant="ghost" size="sm">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor="organization-name" className="text-sm font-medium text-muted-foreground">Name</label>
          <p id="organization-name">{organization.name}</p>
        </div>

        <div>
          <label htmlFor="organization-created" className="text-sm font-medium text-muted-foreground">Created</label>
          <p id="organization-created">{new Date(organization.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}