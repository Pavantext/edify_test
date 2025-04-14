"use client";
import { Button } from "./ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const ShareButton = ({ shareUrl, toolType }: { shareUrl: string, toolType: string }) => {
  const handleShareClick = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(`${toolType} link copied to clipboard!`);
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={handleShareClick} variant="outline">
            <Share2 className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy share link</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ShareButton;