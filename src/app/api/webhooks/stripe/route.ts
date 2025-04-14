import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/utils/supabase/service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(request: Request) {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, sig as string, endpointSecret as string);
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Use the service role client to bypass RLS.
    const supabase = await createServiceClient();

    switch (event.type) {
        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase);
            break;
        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase);
            break;
        case 'invoice.payment_succeeded':
            await handleInvoicePaid(event.data.object as Stripe.Invoice, supabase);
            break;
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
    const subscriptionId = subscription.id;
    const status = subscription.status;
    const startDate = new Date(subscription.start_date * 1000);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Get Stripe customer id from subscription.customer.
    const stripeCustomerId = subscription.customer as string;

    // Get the first subscription item's price.
    const price = subscription.items.data[0]?.price;

    let planName: string;
    let stripeProductId: string | null = null;
    if (price) {
        // price.product is a string (the product ID).
        stripeProductId = typeof price.product === 'string' ? price.product : null;
        try {
            // Fetch the product details from Stripe to get the product's name.
            const product = await stripe.products.retrieve(price.product as string);
            planName = product.name;
        } catch (err) {
            console.error("Error retrieving product details:", err);
            planName = "Unknown Plan";
        }
    } else {
        planName = "Unknown Plan";
    }

    const seats = subscription.items.data[0]?.quantity || 1;

    // Get internal IDs if available from metadata.
    let internalUserId = subscription.metadata.user_id || null;
    let internalOrgId = subscription.metadata.org_id || null;
    // If it's an organization subscription, force user_id to null.
    if (internalOrgId) {
        internalUserId = null;
    }

    // Upsert into the subscriptions table.
    const { error } = await supabase
        .from('subscriptions')
        .upsert({
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: stripeCustomerId,
            status,
            start_date: startDate,
            current_period_end: currentPeriodEnd,
            plan_name: planName,
            stripe_product_id: stripeProductId,
            seats: seats,
            user_id: internalUserId,
            organization_id: internalOrgId,
        }, { onConflict: 'stripe_subscription_id' });

    if (error) {
        console.error('Error upserting subscription (updated):', error);
    } else {
        console.log(`Subscription ${subscriptionId} updated in database.`);
    }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
    const subscriptionId = subscription.id;
    const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscriptionId);

    if (error) {
        console.error('Error updating subscription (deleted):', error);
    } else {
        console.log(`Subscription ${subscriptionId} marked as canceled.`);
    }
}

async function handleInvoicePaid(invoice: Stripe.Invoice, supabase: any) {
    const subscriptionId =
        typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;
    if (!subscriptionId) return;

    // Update current period end using invoice's period_end.
    const currentPeriodEnd = new Date(invoice.period_end * 1000);

    // Upsert/update subscription with the invoice id.
    const { error } = await supabase
        .from('subscriptions')
        .update({
            status: 'active',
            current_period_end: currentPeriodEnd,
            stripe_invoice_id: invoice.id,
        })
        .eq('stripe_subscription_id', subscriptionId);

    if (error) {
        console.error('Error updating subscription (invoice paid):', error);
    } else {
        console.log(`Invoice ${invoice.id} paid; subscription ${subscriptionId} updated.`);
    }
}