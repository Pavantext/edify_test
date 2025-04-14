import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const { sessionId }: { sessionId: string; } = await request.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['customer', 'subscription'],
        });

        if (!session.customer || typeof session.customer === 'string') {
            return NextResponse.json({ error: 'Invalid customer data from Stripe.' }, { status: 400 });
        }

        const stripeCustomerId = session.customer.id;
        const stripeSubscriptionId =
            typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id;

        if (!stripeSubscriptionId) {
            return NextResponse.json({ error: 'No subscription found for this session.' }, { status: 400 });
        }

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
            expand: ['items.data.price.product'],
        });

        const plan = subscription.items.data[0]?.price;

        if (!plan) {
            return NextResponse.json({ error: 'No plan found for this subscription.' }, { status: 400 });
        }

        const stripeProductId = (plan.product as Stripe.Product).id;
        const planName = (plan.product as Stripe.Product).name;
        const subscriptionStatus = subscription.status;

        return NextResponse.json({
            session,
            stripeCustomerId,
            stripeSubscriptionId,
            stripeProductId,
            planName,
            subscriptionStatus,
        });
    } catch (error: any) {
        console.error('Error retrieving session:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 400 }
        );
    }
}