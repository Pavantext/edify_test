import { createServiceClient } from '@/utils/supabase/service';
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from "@clerk/nextjs/server";

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { status } = await request.json();
    const { id } = await params;

    const supabase = createServiceClient();

    // Get the waitlist entry first
    const { data: waitlistEntry } = await supabase
      .from('waitlist')
      .select('email')
      .eq('id', id)
      .single();

    if (!waitlistEntry) {
      return NextResponse.json(
        { error: 'Waitlist entry not found' },
        { status: 404 }
      );
    }

    // Get base URL from request and keep within same environment
    const origin = request.headers.get('origin');
    let redirectBase = 'https://app.aiedify.com'; // default production

    if (origin?.includes('edify-dev.vercel.app')) {
      redirectBase = 'https://edify-dev.vercel.app';
    }

    // If changing to invited status
    if (status === 'invited') {
      try {
        await (await clerkClient()).invitations.createInvitation({
          emailAddress: waitlistEntry.email,
          redirectUrl: `${redirectBase}/sign-up`,
          publicMetadata: {
            source: 'waitlist',
            invitedAt: new Date().toISOString(),
            ticketId: id
          }
        });
        console.log('Invitation sent to:', waitlistEntry.email);
      } catch (inviteError) {
        console.error('Failed to send invitation:', inviteError);
        return NextResponse.json(
          { error: 'Failed to send invitation' },
          { status: 500 }
        );
      }
    }

    // Update Supabase status
    const updateData = { 
      status,
      approved_at: status === 'invited' ? new Date().toISOString() : null
    };

    const { error } = await supabase
      .from('waitlist')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: status === 'invited' 
        ? 'Status updated and invitation sent'
        : 'Status updated'
    });
  } catch (error) {
    console.error('Error updating waitlist entry:', error);
    return NextResponse.json(
      { error: 'Failed to update waitlist entry' },
      { status: 500 }
    );
  }
} 