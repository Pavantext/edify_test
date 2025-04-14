'use client';

import { Suspense, useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

const Page = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');

    const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
    const [customerEmail, setCustomerEmail] = useState<string | null>(null);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [planName, setPlanName] = useState<string | null>(null);
    const [productId, setProductId] = useState<string | null>(null);
    const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string>("");

    useEffect(() => {
        if (!sessionId) {
            router.replace('/pricing');
            return;
        }
        fetchSessionStatus();
    }, [sessionId, router]);

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push('/');
        }, 5000);
        return () => clearTimeout(timer);
    }, [router]);

    async function fetchSessionStatus() {
        try {
            const response = await fetch('/api/check-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch session status');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            console.log(data);

            setCustomerEmail(data.session.customer_email);
            setCustomerId(data.stripeCustomerId);
            setPlanName(data.planName);
            setProductId(data.stripeProductId);
            setSubscriptionId(data.stripeSubscriptionId);
            setSubscriptionStatus(data.subscriptionStatus);
            setStatus('success');
        } catch (error) {
            console.error('Error fetching session status:', error);
            setStatus('failed');
        }
    }

    return (
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                {/* Loading State */}
                {status === 'loading' && (
                    <>
                        <div className="flex justify-center mb-4">
                            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                        </div>
                        <h1 className="text-2xl font-bold text-blue-600">Processing Payment...</h1>
                        <p className="text-gray-600 mt-2">Please wait while we confirm your subscription.</p>
                    </>
                )}

                {/* Success State */}
                {status === 'success' && (
                    <>
                        <div className="flex justify-center mb-4">
                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-16 h-16 text-green-500" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-green-600">Thank You!</h1>
                        <p className="text-gray-600 mt-2">Payment done successfully</p>
                        <p className="text-gray-500 text-sm mt-2">
                            Subscription: <strong>{planName || 'Unknown Plan'}</strong>
                        </p>
                        {/* <p className="text-gray-500 text-sm mt-2">
                            Subscription ID: <strong>{subscriptionId || 'N/A'}</strong>
                        </p> */}
                        {/* <p className="text-gray-500 text-sm mt-2">
                            A confirmation email has been sent to <strong>{customerEmail}</strong>.
                        </p> */}
                        <p className="text-gray-500 text-sm mt-2">
                            You will be redirected to the home page shortly
                            <br />
                            or click below to return home.
                        </p>
                        <Button
                            onClick={() => router.push('/')}
                            className="mt-6 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg"
                        >
                            Home
                        </Button>
                    </>
                )}

                {/* Failed State */}
                {status === 'failed' && (
                    <>
                        <div className="flex justify-center mb-4">
                            <XCircle className="w-16 h-16 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-bold text-red-600">Payment Failed</h1>
                        <p className="text-gray-600 mt-2">Something went wrong while processing your payment.</p>
                        <p className="text-gray-500 text-sm mt-2">
                            Please try again or contact support.
                        </p>
                        <Button
                            onClick={() => router.push('/pricing')}
                            className="mt-6 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg"
                        >
                            Try Again
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

const PageWrapper = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Page />
        </Suspense>
    );
};

export default PageWrapper;