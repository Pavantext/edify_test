import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoreVertical, Edit2, Copy, Trash, Share2, MessageSquare, Download } from 'lucide-react';
import type { ChatSession } from "@/schemas/chat-schema";
import { toast } from "sonner";

export interface PromptRecord {
  content: string;
  created_at: string;
  id: string;
  model: string;
  role: string;
}

export interface Session {
  created_at: string;
  id: string;
  messages: PromptRecord[];
  model: string;
  title: string;
  updated_at: string;
  user_id: string;
}

interface SessionManagerProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: (session: ChatSession) => void;
  onRename: (sessionId: string, newTitle: string) => Promise<void>;
  onDuplicate: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
  onDownload?: (session: Session) => Promise<void>;
}

export function SessionManager({
  session,
  isActive,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onDownload,
}: SessionManagerProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title);

  const handleRename = async () => {
    try {
      await onRename(session.id, newTitle);
      setIsRenaming(false);
      toast.success("Chat renamed successfully");
    } catch (error) {
      toast.error("Failed to rename chat");
      console.error('Failed to rename session:', error);
    }
  };

  // const handleShare = async () => {
  //   try {
  //     if (onShare) {
  //       await onShare(session);
  //       toast.success("Chat link copied to clipboard");
  //     }
  //   } catch (error) {
  //     toast.error("Failed to share chat");
  //     console.error('Failed to share session:', error);
  //   }
  // };

  const handleDowload = async () => {
    if (onDownload) {
      await onDownload(session);
    }
  };

  return (
    <div className="flex items-center justify-between px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg group">
      <Button
        variant="ghost"
        className={`flex-1 justify-start gap-2 h-auto py-2 px-2 min-w-0 ${isActive ? 'bg-gray-100 dark:bg-gray-800' : ''
          }`}
        onClick={() => onSelect(session)}
      >
        <MessageSquare className="h-4 w-4 shrink-0 text-[#70CDB3]" />
        <span
          className="truncate text-sm hover:text-clip hover:overflow-x-auto hover:whitespace-normal"
          title={session.title}
        >
          {session.title}
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setIsRenaming(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(session.id)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          {onDownload && (
            <DropdownMenuItem onClick={handleDowload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleting(true)}
            className="text-red-600 dark:text-red-400"
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter new title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleting} onOpenChange={setIsDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this chat? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await onDelete(session.id);
                  setIsDeleting(false);
                  toast.success("Chat deleted successfully");
                } catch (error) {
                  toast.error("Failed to delete chat");
                  console.error('Failed to delete session:', error);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 