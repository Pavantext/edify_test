import { createServiceClient } from '@/utils/supabase/service';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, account_type, organization_name } = await req.json();
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('waitlist')
      .update({ 
        account_type,
        organization_name,
        org_status: account_type === 'organization' ? 'pending' : null
      })
      .eq('email', email);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user type:', error);
    return NextResponse.json(
      { error: 'Failed to update user type' },
      { status: 500 }
    );
  }
} 