"use client";

import { useOrganization } from "@clerk/nextjs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MoreHorizontal } from "lucide-react";
import { SubjectAssignModal } from "@/components/modals/subject-assign-modal";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

const getRoleName = (role: string) => {
  const roleMap: Record<string, string> = {
    'org:admin': 'Admin',
    'org:educator': 'Educator'
  };
  return roleMap[role] || role;
};

interface UserSubjects {
  [key: string]: string[];
}

export function OrganizationMembers() {
  const { organization, memberships, isLoaded } = useOrganization({
    memberships: {
      infinite: true,
      keepPreviousData: true
    }
  });
  const [userSubjects, setUserSubjects] = useState<UserSubjects>({});
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const loadSubjects = async () => {
      if (memberships?.data) {
        const subjects: UserSubjects = {};
        const promises = memberships.data.map(async (member) => {
          const userId = member.publicUserData?.userId;
          if (userId) {
            try {
              const response = await fetch(`/api/subjects?userId=${userId}`);
              const data = await response.json();
              subjects[userId] = data.subjects;
            } catch (error) {
              console.error("Error loading subjects for user:", userId, error);
              subjects[userId] = [];
            }
          }
        });

        await Promise.all(promises);
        setUserSubjects(subjects);
      }
    };

    loadSubjects();
  }, [memberships?.data]);

  const handleSubjects = async (userId: string) => {
    const response = await fetch(`/api/subjects?userId=${userId}`);
    const data = await response.json();
    setUserSubjects(prev => ({ ...prev, [userId]: data.subjects }));
  };

  if (!isLoaded) return <div>Loading...</div>;
  if (!organization || !memberships?.data) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Organisation Members</h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Subjects</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberships.data.map((member) => {
            const userId = member.publicUserData?.userId as string;
            const subjects = userSubjects[userId] || [];

            return (
              <TableRow key={member.id}>
                <TableCell>
                  {member.publicUserData?.firstName} {member.publicUserData?.lastName}
                </TableCell>
                <TableCell>{member.publicUserData?.identifier}</TableCell>
                <TableCell>{getRoleName(member.role)}</TableCell>
                <TableCell>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="cursor-pointer inline-flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-full">
                        <MoreHorizontal className="h-4 w-4" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-60">
                      <div className="space-y-4">
                        <h4 className="font-medium">Assigned Subjects</h4>
                        {subjects.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {subjects.map((subject, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs"
                              >
                                {subject}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No subjects assigned</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMemberId(member.publicUserData?.userId as string);
                      setIsModalOpen(true);
                    }}
                  >
                    Assign Subjects
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {memberships.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => memberships.fetchNext()}
            disabled={!memberships.hasNextPage}
          >
            Load More
          </Button>
        </div>
      )}

      {selectedMemberId && (
        <SubjectAssignModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMemberId(null);
          }}
          memberId={selectedMemberId}
        />
      )}
    </div>
  );
}