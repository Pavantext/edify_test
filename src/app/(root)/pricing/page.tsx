'use client';

import { useEffect, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import PricingCard from './pricing-card';
import { useAuth } from '@clerk/nextjs';

const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string
);

interface SubscriptionPlan {
    id: string;
    name: string;
    description: string;
    price: number;
    interval: string;
    price_id: string;
}

export default function Subscriptions() {
    const [individualPlan, setIndividualPlan] = useState<SubscriptionPlan>({
        id: '',
        name: '',
        description: '',
        price: 0,
        interval: '',
        price_id: '',
    });
    const [teamPlan, setTeamPlan] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [email, setEmail] = useState("");
    const { userId, orgId, orgRole } = useAuth();

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch('/api/subscription-plans');
                if (!res.ok) throw new Error('Failed to fetch subscription plans');
                const data = await res.json();
                setIndividualPlan(
                    data.find(
                        (plan: SubscriptionPlan) => plan.name === 'AiEdify' && plan.interval === 'month'
                    )
                );
                setTeamPlan(
                    data.filter(
                        (plan: SubscriptionPlan) => ['Small', 'Medium', 'Large'].includes(plan.name) && plan.interval === 'month'
                    )
                );
            } catch (err: any) {
                setError('Failed to load subscription plans. Please try again.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPlans();
    }, []);

    useEffect(() => {
        const fetchIsAdmin = async () => {
            try {
                const res = await fetch('/api/pricing');
                if (!res.ok) throw new Error('Failed to fetch admin status');
                const data = await res.json();
                setIsAdmin(data.isAdmin);
                setEmail(data.emailAddress);
            } catch (err) {
                console.error(err);
            }
        };

        fetchIsAdmin();
    }, []);

    const handleSubscribe = async (priceId: string, memberCount: number) => {
        try {
            const stripe = await stripePromise as Stripe;
            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId, email, memberCount, isAdmin, orgId, userId }),
            });

            if (!response.ok) throw new Error('Failed to create checkout session');

            const { sessionId } = await response.json();
            const result = await stripe.redirectToCheckout({ sessionId });

            if (result.error) {
                console.error(result.error);
                setError(result.error.message as string);
            }
        } catch (err: any) {
            setError('Error processing subscription. Please try again.');
            console.error(err);
        }
    };

    if (loading)
        return (
            <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-[#2c9692] rounded-full animate-spin"></div>
            </div>
        );

    if (error) return <p className="text-center text-red-500">{error}</p>;

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Pricing Header */}
            {isAdmin && <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Choose Your Plan
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    Select the perfect plan for your team's needs. All plans include our core features.
                </p>
            </div>}

            {/* Pricing Cards Container */}
            <div className={`grid gap-8 mx-auto ${isAdmin ? 'lg:grid-cols-3 md:grid-cols-2' : 'max-w-md'}`}>
                {isAdmin ? (
                    teamPlan.map((plan) => (
                        <PricingCard
                            key={plan.id}
                            name={plan.name}
                            price={plan.price}
                            interval={plan.interval}
                            features={[
                                'Access to all tools',
                                'Unlimited Usage',
                                'Priority Support',
                                'Unlimited Organization Members',
                                'Advanced Analytics',
                            ]}
                            priceId={plan.price_id}
                            onSubscribe={handleSubscribe}
                            isAdmin={isAdmin}
                        />
                    ))
                ) : (
                    <PricingCard
                        key={individualPlan.id}
                        name={individualPlan.name}
                        price={individualPlan.price}
                        interval={individualPlan.interval}
                        features={[
                            'Access to all tools',
                            'Unlimited Usage',
                            'Priority Support',
                            'Basic Analytics',
                        ]}
                        priceId={individualPlan.price_id}
                        onSubscribe={handleSubscribe}
                    />
                )}
            </div>
        </main>
    );
}