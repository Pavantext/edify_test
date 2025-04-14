'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export function SubmitButton({ onClick }: { onClick?: () => void; }) {
    const { pending } = useFormStatus();

    return (
        <Button
            type="button"
            disabled={pending}
            onClick={onClick}
            className="w-full bg-white hover:bg-[#2c9692] text-black hover:text-white border border-gray-200 rounded-full flex items-center justify-center"
        >
            {pending ? (
                <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Loading...
                </>
            ) : (
                <>
                    Subscribe Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                </>
            )}
        </Button>
    );
}