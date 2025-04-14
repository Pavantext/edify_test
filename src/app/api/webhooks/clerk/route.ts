import { createServiceClient } from '@/utils/supabase/service';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = createServiceClient();

  try {
    console.log('Webhook received:', new Date().toISOString());

    // Get headers
    const headerPayload = await headers();
    const svix_id = await headerPayload.get("svix-id");
    const svix_timestamp = await headerPayload.get("svix-timestamp");
    const svix_signature = await headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing svix headers');
      return NextResponse.json(
        { error: 'Missing svix headers' },
        { status: 400 }
      );
    }

    // Get the body
    const req = request.clone();
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Verify webhook
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    let evt: WebhookEvent;

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error('Verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the webhook
    console.log('Processing webhook:', evt.type);

    switch (evt.type) {
      case 'user.created':
      case 'user.updated':
        await handleUser(evt.data);
        break;
      case 'user.deleted':
        await handleUserDeleted(evt.data);
        break;
      case 'organization.created':
        await handleOrgCreated(evt.data);
        break;
      case 'organization.updated':
        await handleOrgCreated(evt.data);
        break;
      case 'organization.deleted':
        await handleOrgDeleted(evt.data);
        break;
      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await handleOrgMembership(evt.data);
        break;
      default:
        console.log('Unhandled event type:', evt.type);
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function handleUser(data: any) {
  const supabase = createServiceClient();
  console.log('Processing user data:', data.id);

  try {
    const userData = {
      id: data.id,
      email: data.email_addresses?.[0]?.email_address,
      username: data.username ? `${data.username}_${data.id.slice(-6)}` : null,
      first_name: data.first_name,
      last_name: data.last_name,
      image_url: data.image_url,
      metadata: {
        public: data.public_metadata,
        private: data.private_metadata,
        unsafe: data.unsafe_metadata
      }
    };

    // Use upsert with onConflict to handle duplicates
    const { error } = await supabase
      .from('users')
      .upsert(userData, {
        onConflict: 'id'
      });

    if (error) {
      // Log error but don't throw for duplicate emails
      if (error.code === '23505' && error.message.includes('email')) {
        console.log('User already exists with this email, updating other fields');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('User handler error:', error);
    throw error;
  }
}

async function handleUserDeleted(data: any) {
  const supabase = createServiceClient();
  console.log('Deleting user:', data.id);
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', data.id);
  if (error) throw error;
}

async function handleOrgCreated(data: any) {
  const supabase = createServiceClient();
  console.log('Processing organization:', data.id);

  try {
    // Create/update organization
    const { error: orgError } = await supabase
      .from('organizations')
      .upsert({
        id: data.id,
        name: `${data.name}_${data.id.slice(-6)}`,
        slug: `${data.slug}_${data.id.slice(-6)}`,
        image_url: data.image_url,
        metadata: data.public_metadata || {}
      });

    if (orgError) throw orgError;

    // If this is created by a user
    if (data.created_by) {
      // Add creator as admin
      const { error: memberError } = await supabase
        .from('org_members')
        .upsert({
          org_id: data.id,
          user_id: data.created_by,
          role: 'admin'
        });

      if (memberError) throw memberError;

      // Update user's default_org_id
      const { error: userError } = await supabase
        .from('users')
        .update({ default_org_id: data.id })
        .eq('id', data.created_by);

      if (userError) throw userError;
    }
  } catch (error) {
    console.error('Organization error:', error);
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === '23505') {
        console.log('Organization name already exists, continuing...');
        return;
      }
    }
    throw error;
  }
}

async function handleOrgDeleted(data: any) {
  const supabase = createServiceClient();
  console.log('Deleting organization:', data.id);

  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', data.id);

    if (error) throw error;
  } catch (error) {
    console.error('Organization deletion error:', error);
    throw error;
  }
}

async function handleOrgMembership(data: any) {
  const supabase = createServiceClient();
  console.log('Processing membership:', data.id);

  try {
    // First check if organization exists
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', data.organization.id)
      .single();

    if (!existingOrg) {
      // Create organization if it doesn't exist
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          id: data.organization.id,
          name: `${data.organization.name}_${data.organization.id.slice(-6)}`,
          slug: `${data.organization.slug}_${data.organization.id.slice(-6)}`,
          image_url: data.organization.image_url,
          metadata: data.organization.public_metadata || {}
        });

      if (orgError) throw orgError;
    }

    // Convert 'org:admin' to 'admin'
    const role = data.role.replace('org:', '');

    const { error } = await supabase
      .from('org_members')
      .upsert({
        org_id: data.organization.id,
        user_id: data.public_user_data.user_id,
        role: role // Now will be 'admin' or 'member'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Membership error:', error);
    throw error;
  }
}

async function testDatabaseConnection() {
  const supabase = createServiceClient();
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact' });

    if (error) throw error;
    console.log('Database connected, user count:', data);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json(
    { status: 'ready' },
    { status: 200 }
  );
}