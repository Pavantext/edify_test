'use client';

import { useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type OrganizationRole = 'admin' | 'educator';

export default function RoleSelector({ 
  userId, 
  currentRole 
}: { 
  userId: string;
  currentRole: OrganizationRole;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { organization } = useOrganization();

  const updateMemberRole = async (role: OrganizationRole) => {
    if (!organization) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/organization/update-member-role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId, 
          role,
          organizationId: organization.id 
        }),
      });

      if (!response.ok) throw new Error('Failed to update role');
      
      toast.success('Member role updated successfully');
    } catch (error) {
      toast.error('Failed to update member role');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubjects = async () => {
    const response = await fetch(`/api/subjects?userId=${userId}`);
    const data = await response.json();
    return data.subjects;
  };

  const updateSubjects = async (subjects: string[]) => {
    await fetch('/api/subjects', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, subjects })
    });
  };

  return (
    <Select 
      onValueChange={updateMemberRole} 
      disabled={isLoading}
      defaultValue={currentRole}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="educator">Educator</SelectItem>
      </SelectContent>
    </Select>
  );
}