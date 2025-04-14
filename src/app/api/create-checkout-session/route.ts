import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type SubscriptionPayload = {
    priceId: string;
    email: string;
    memberCount: number;
    isAdmin: boolean;
    orgId: string;
    userId: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const payload: SubscriptionPayload = await request.json();
        const { priceId, email, memberCount, isAdmin, orgId, userId } = payload;

        if (!priceId) {
            return NextResponse.json(
                { error: 'Missing priceId' },
                { status: 400 }
            );
        }

        const origin = request.headers.get('origin');
        if (!origin) {
            return NextResponse.json(
                { error: 'Missing origin header' },
                { status: 400 }
            );
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card', 'link'],
            line_items: [
                {
                    price: priceId,
                    quantity: memberCount,
                },
            ],
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/pricing`,
            customer_email: email,
            subscription_data: {
                metadata: {
                    user_id: isAdmin ? '' : userId,
                    org_id: isAdmin ? orgId : '',
                },
            },
        });

        return NextResponse.json({ sessionId: session.id });
    } catch (error) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json(
            { error: 'Error creating checkout session' },
            { status: 500 }
        );
    }
}
