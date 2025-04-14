import { CheckCircle } from 'lucide-react';

interface ApprovedChatBannerProps {
    promptText: string;
}

export const ApprovedChatBanner = ({ promptText }: ApprovedChatBannerProps) => {
    return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                    <h3 className="text-green-800 font-medium">Approved Content</h3>
                    <p className="text-green-700 text-sm mt-1">
                        This chat contains approved content: "{promptText}"
                    </p>
                    <p className="text-green-600 text-sm mt-2">
                        You can continue the conversation without moderation checks.
                    </p>
                </div>
            </div>
        </div>
    );
}; 