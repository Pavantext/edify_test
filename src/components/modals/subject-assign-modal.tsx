"use client";

import { useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubjectForm } from "@/components/subjects/subject-form";
import { useToast } from "@/hooks/use-toast";

interface SubjectAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string | null;
}

export function SubjectAssignModal({ isOpen, onClose, memberId }: SubjectAssignModalProps) {
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  if (!memberId) return null;

  const handleSubmit = async (subjects: string[]) => {
    try {
      // Updated to use new API endpoint
      const response = await fetch('/api/subjects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: memberId, 
          subjects 
        })
      });

      if (!response.ok) throw new Error('Failed to update subjects');
      
      onClose();
      toast({
        title: "Success",
        description: "Subjects updated successfully",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update subjects",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Subjects to Member</DialogTitle>
        </DialogHeader>
        <SubjectForm 
          userId={memberId}
          onComplete={(subjects: string[]) => handleSubmit(subjects)}
        />
      </DialogContent>
    </Dialog>
  );
}