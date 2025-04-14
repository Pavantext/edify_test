import { createServiceClient } from '@/utils/supabase/service';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from "@clerk/nextjs/server";


type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const { org_status } = await req.json();
    console.log('Starting org status update:', { id, org_status });

    const supabase = createServiceClient();

    // Get waitlist entry
    const { data: waitlistEntry, error: fetchError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('id', id)
      .single();

    console.log('Fetched waitlist entry:', { waitlistEntry, fetchError });

    if (fetchError || !waitlistEntry) {
      return NextResponse.json(
        { error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    // If approving, create Clerk organization
    if (org_status === 'approved') {
      try {
        const clerk = await clerkClient();
        let users = await clerk.users.getUserList({
          emailAddress: [waitlistEntry.email]
        });
        console.log('Found users:', users.data.length);

        let user = users.data[0];
        if (!user) {
          console.log('Creating new Clerk user');
          user = await clerk.users.createUser({
            emailAddress: [waitlistEntry.email],
            skipPasswordRequirement: true
          });
        }

        // Only create organization
        console.log('Creating organization');
        await clerk.organizations.createOrganization({
          name: waitlistEntry.organization_name,
          createdBy: user.id,
          publicMetadata: {
            created_from_waitlist: true
          }
        });
      } catch (error) {
        console.error('Error in Clerk setup:', error);
        return NextResponse.json(
          { error: 'Failed to set up in Clerk' },
          { status: 500 }
        );
      }
    }

    // Update waitlist status
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        org_status,
        approved_at: org_status === 'approved' ? new Date().toISOString() : null
      })
      .eq('id', id);

    console.log('Updated waitlist status:', { updateError });

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error handling org status update:', error);
    return NextResponse.json(
      { error: 'Failed to update organisation status' },
      { status: 500 }
    );
  }
}

function generateSlug(name: string): string {
  // Convert to lowercase and replace spaces with underscores
  const baseSlug = name.toLowerCase().replace(/\s+/g, '_');
  // Add random string
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}_${randomString}`;
}