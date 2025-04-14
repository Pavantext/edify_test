"use client";

import { useEffect, useState } from "react";
import { useUser, useOrganization } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubjectForm } from "@/components/subjects/subject-form";

export function SubjectModal() {
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  // useEffect(() => {
  //   if (
  //     isLoaded &&
  //     user &&
  //     (!user.unsafeMetadata?.subjects) && // Add optional chaining
  //     !organization
  //   ) {
  //     setIsOpen(true);
  //   }
  // }, [isLoaded, user, organization]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome to AI Edify!</DialogTitle>
          <DialogDescription>
            Please select your subjects to get started. You can add or remove subjects later.
          </DialogDescription>
        </DialogHeader>
        <SubjectForm onComplete={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}