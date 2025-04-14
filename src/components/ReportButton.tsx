"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { AlertCircle, Loader2, Paperclip, X, Bug } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Badge } from "./ui/badge";

interface ReportButtonProps {
  toolType?: string;    // e.g., 'lesson_plan', 'chat', etc.
  resultId?: string;    // UUID from the tool's result table
  position?: 'fixed' | 'inline';  // To control button positioning
  variant?: 'pre' | 'post';  // Add variant prop
}

export function ReportButton({ 
  toolType, 
  resultId,
  position = 'fixed',
  variant = 'post'  // Default to post-generation
}: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const { user } = useUser();
  const supabase = createClient();

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setAttachments([]);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    // Limit file size to 5MB
    const validFiles = newFiles.filter(file => file.size <= 5 * 1024 * 1024);
    
    if (validFiles.length !== newFiles.length) {
      toast.error("Some files were too large. Maximum size is 5MB per file.");
    }
    
    setAttachments(currentFiles => [...currentFiles, ...validFiles]);
    
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setAttachments(current => current.filter(file => file !== fileToRemove));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to report an issue");
      return;
    }
    
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const ticketData = {
        user_id: user.id,
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        tool_type: toolType || null,
        result_id: resultId || null,
        priority: (formData.get("priority") as string) || 'medium',
        status: 'open'
      };

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('data', JSON.stringify(ticketData));
      attachments.forEach(file => {
        submitData.append('attachments', file);
      });

      const response = await fetch('/api/tickets', {
        method: 'POST',
        body: submitData
      });

      if (!response.ok) {
        throw new Error('Failed to submit ticket');
      }

      toast.success("Report submitted successfully", {
        description: "We'll look into this as soon as possible."
      });
      
      setIsOpen(false);
      setAttachments([]); // Reset attachments after successful submission
    } catch (err) {
      console.error('Error details:', err);
      toast.error("Failed to submit report", {
        description: err instanceof Error ? err.message : "Please try again later."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`
            ${position === 'fixed' ? 'fixed bottom-4 right-4 z-50' : ''} 
            bg-black/5 border-black/20 hover:bg-red-100 rounded-full p-2
            text-red-500 hover:text-red-500 hover:border-red-200
          `}
        >
          <Bug className="h-5 w-5" strokeWidth={2.5}/>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="items-center">
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription className="sr-only">
            Form to report issues or provide feedback about the tool
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              name="title"
              placeholder="Issue Title"
              required
              className="w-full"
            />
          </div>
          <div>
            <Textarea
              name="description"
              placeholder="Describe the issue..."
              required
              className="min-h-[100px]"
            />
          </div>
          <div>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-600 cursor-pointer">
              <Badge variant="outline" className="cursor-pointer hover:bg-gray-100 inline-flex">
                <Paperclip className="h-3 w-3 mr-1" />
                Attach files
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                <Input
                  type="file"
                  name="attachments"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </Badge>
            </label>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <Badge key={index} variant="secondary" className="inline-flex items-center gap-2 max-w-fit">
                    {file.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(file)}
                      className="hover:bg-gray-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {toolType && (
            <div className="text-sm text-muted-foreground">
              Tool: {toolType}
            </div>
          )}
          {resultId && (
            <div className="text-sm text-muted-foreground">
              Response ID: {resultId}
            </div>
          )}
          <Button type="submit" disabled={isLoading} className="w-full bg-red-800 text-white">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 