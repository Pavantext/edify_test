'use client';

import { useState } from 'react';
import { MessageActions } from './MessageActions';
import { PromptViolationIndicator } from './PromptViolationIndicator';
import { ChatMessage as ChatMessageType } from '@/schemas/chat-schema';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
  contentId?: string;
  contentFlags?: ContentFlags;
  onRetry?: (content: string) => Promise<void>;
  onEdit?: (content: string) => Promise<void>;
  onStatusUpdate?: (status: 'pending' | 'approved' | 'declined' | 'not_requested') => void;
}

interface ContentFlags {
  pii_detected?: boolean;
  content_violation?: boolean;
  bias_detected?: boolean;
  prompt_injection_detected?: boolean;
  fraudulent_intent_detected?: boolean;
  misinformation_detected?: boolean;
  self_harm_detected?: boolean;
  extremist_content_detected?: boolean;
  child_safety_violation?: boolean;
  automation_misuse_detected?: boolean;
  moderator_approval?: 'pending' | 'approved' | 'declined' | 'not_requested';
}

export function ChatMessage({ 
  message, 
  contentId, 
  contentFlags, 
  onRetry, 
  onEdit, 
  onStatusUpdate 
}: ChatMessageProps) {
  const [currentFlags, setCurrentFlags] = useState<ContentFlags | undefined>(contentFlags);

  const handleStatusUpdate = (status: 'pending' | 'approved' | 'declined' | 'not_requested') => {
    setCurrentFlags(prev => ({
      ...prev,
      moderator_approval: status
    }));
  };

  return (
    <div className={cn(
      'group relative mb-4 flex items-start md:mb-6',
      message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'
    )}>
      <div className="flex-1 px-1 ml-4 space-y-2 overflow-hidden">
        <div className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0">
          {message.content}
        </div>
        
        {onRetry && onEdit && (
          <div className="flex justify-end">
            <MessageActions 
              message={message} 
              onRetry={onRetry} 
              onEdit={onEdit} 
            />
          </div>
        )}

        {contentFlags && contentId && (
          <PromptViolationIndicator 
            flags={currentFlags || contentFlags}
            contentId={contentId}
            onStatusUpdate={handleStatusUpdate}
          />
        )}
      </div>
    </div>
  );
} 