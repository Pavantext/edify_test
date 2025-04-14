import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/utils/supabase/service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(request: Request) {
    try {
        // Ensure the user is authenticated.
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Retrieve the Stripe Customer ID for the authenticated user.
        const stripeCustomerId = await getStripeCustomerId(userId);
        if (!stripeCustomerId) {
            return NextResponse.json({ error: 'Stripe customer not found' }, { status: 404 });
        }

        // Create a billing portal session.
        const origin = request.headers.get('origin');
        if (!origin) {
            return NextResponse.json({ error: 'Missing origin header' }, { status: 400 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${origin}/account`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Error creating customer portal session:', error);
        return NextResponse.json({ error: 'Error creating portal session' }, { status: 500 });
    }
}

// Helper function to fetch the Stripe Customer ID for a given userId.
async function getStripeCustomerId(userId: string): Promise<string | null> {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();
    if (error) {
        console.error('Error fetching stripe customer id:', error);
        return null;
    }
    return data?.stripe_customer_id;
}