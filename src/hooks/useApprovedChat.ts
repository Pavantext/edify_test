import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface UseApprovedChatProps {
    metricsId?: string;
}

export function useApprovedChat({ metricsId }: UseApprovedChatProps) {
    const [isApprovedChat, setIsApprovedChat] = useState(false);

    const checkViolations = async (message: string) => {
        // If this is an approved chat, skip violation checks
        if (metricsId) {
            const supabase = createClient();
            const { data } = await supabase
                .from('ai_tools_metrics')
                .select('moderator_approval')
                .eq('id', metricsId)
                .single();

            if (data?.moderator_approval === 'approved') {
                setIsApprovedChat(true);
                return {
                    hasViolations: false,
                    violations: [],
                    canProceed: true
                };
            }
        }

        // Otherwise, perform normal violation checks
        // You would call your existing violation check logic here
        return {
            hasViolations: false,
            violations: [],
            canProceed: true
        };
    };

    return {
        isApprovedChat,
        checkViolations
    };
} 