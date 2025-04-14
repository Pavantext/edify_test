'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface RequestReviewButtonProps {
  contentId: string;
  onRequestComplete?: (updatedStatus: 'pending' | 'approved' | 'declined' | 'not_requested') => void;
}

export function RequestReviewButton({ contentId, onRequestComplete }: RequestReviewButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestReview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/moderator/violations/${contentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request review');
      }

      toast.success('Review requested successfully', {
        description: 'A moderator will review your content shortly.',
      });

      // Update parent component with new status
      if (onRequestComplete) {
        onRequestComplete('pending');
      }
    } catch (error) {
      console.error('Error requesting review:', error);
      toast.error('Failed to request review', {
        description: error instanceof Error ? error.message : 'Please try again later',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleRequestReview}
      disabled={isLoading}
      variant="outline"
      className="bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Requesting...
        </>
      ) : (
        'Request Review'
      )}
    </Button>
  );
} 