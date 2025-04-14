import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { createServiceClient } from '@/utils/supabase/service'
import { NextResponse } from 'next/server'

const webhookSecret = process.env.CLERK_WAITLIST_WEBHOOK_SECRET
const supabase = createServiceClient()

interface WaitlistEvent {
  type: string;
  data: {
    email_address: string;
    status: string;
    created_at: string;
    [key: string]: any;
  };
}

export async function POST(req: Request) {
  console.log('=== WEBHOOK HANDLER START ===');
  console.log('Request received at:', new Date().toISOString());

  try {
    // Get the raw body first
    const rawBody = await req.text();
    console.log('Raw body received:', rawBody);

    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id") ?? '';
    const svix_timestamp = headerPayload.get("svix-timestamp") ?? '';
    const svix_signature = headerPayload.get("svix-signature") ?? '';

    console.log('Webhook headers:', {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature
    });

    if (!webhookSecret) {
      console.error('Missing CLERK_WAITLIST_WEBHOOK_SECRET:', webhookSecret);
      return new Response('Webhook secret not configured', { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const wh = new Webhook(webhookSecret);
    
    // Verify with raw body
    let evt: WaitlistEvent;
    try {
      evt = wh.verify(rawBody, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WaitlistEvent;
    } catch (err) {
      console.error('Verification error details:', err);
      return new Response(
        JSON.stringify({ error: 'Webhook verification failed', details: err instanceof Error ? err.message : 'Unknown error' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Only process waitlist entry creation
    if (evt.type === 'waitlistEntry.created') {
      const { email_address } = evt.data;
      
      // Check if email already exists
      const { data: existingEntry } = await supabase
        .from('waitlist')
        .select('email')
        .eq('email', email_address)
        .single();

      if (!existingEntry) {
        // Insert new entry
        const { error: insertError } = await supabase
          .from('waitlist')
          .insert([{
            email: email_address,
            status: 'pending',
            created_at: new Date().toISOString(),
            account_type: null,
            approved_at: null
          }]);

        if (insertError) {
          console.error('Failed to insert waitlist entry:', insertError);
          return new Response('Failed to store waitlist entry', { status: 500 });
        }
      }
    }

    return new Response('Webhook processed successfully', { status: 200 });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', details: err instanceof Error ? err.message : 'Unknown error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}