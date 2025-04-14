/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

const PromptActions = ({ promptText }: { promptText: string }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      toast("Prompt has been copied to your clipboard");
    } catch (err: any) {
      toast("Failed to copy");
      console.log(err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([promptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-${Date.now()}.txt`; // Add a filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={handleCopy}
        className='flex items-center gap-1'
      >
        <Copy className='h-4 w-4' />
        Copy
      </Button>
      {/* <Button
        variant='outline'
        size='sm'
        onClick={handleDownload}
        className='flex items-center gap-1'
      >
        <Download className='h-4 w-4' />
        Download
      </Button> */}
    </div>
  );
};

export default PromptActions;
