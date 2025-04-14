import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function GET(): Promise<NextResponse> {
    try {
        const prices = await stripe.prices.list({
            expand: ['data.product'],
            active: true,
            type: 'recurring',
        });

        const plans = prices.data.map(price => ({
            id: price.id,
            name: (price.product as Stripe.Product).name,
            description: (price.product as Stripe.Product).description,
            price: price.unit_amount,
            interval: price.recurring?.interval,
            price_id: price.id,
        }));

        return NextResponse.json(plans);
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        return NextResponse.json(
            { error: 'Error fetching subscription plans' },
            { status: 500 }
        );
    }
}