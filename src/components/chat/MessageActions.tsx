import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check, RotateCcw, Edit2 } from "lucide-react";
import { ChatMessage } from "@/schemas/chat-schema";
import { toast } from "sonner";

interface MessageActionsProps {
  message: ChatMessage;
  onRetry: (content: string) => Promise<void>;
  onEdit: (content: string) => Promise<void>;
}

export function MessageActions({ message, onRetry, onEdit }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = async () => {
    try {
      await onEdit(editContent);
      setIsEditing(false);
      toast.success("Message updated");
    } catch (error) {
      toast.error("Failed to update message");
    }
  };

  if (isEditing) {
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-[100px]"
        />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </Button>
          <Button 
            size="sm"
            onClick={handleEdit}
          >
            Save & Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="h-8 w-8"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      
      {message.role === 'user' && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEditing(true)}
            className="h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRetry(message.content)}
            className="h-8 w-8"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
} 