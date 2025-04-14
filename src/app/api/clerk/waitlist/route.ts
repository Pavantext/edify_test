import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Check both waitlist and users tables in parallel
    const [waitlistCheck, userCheck] = await Promise.all([
      // Check waitlist table
      supabase
        .from('waitlist')
        .select('email, status')
        .eq('email', email)
        .single(),
      
      // Check users table
      supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single()
    ]);

    // Check user table first
    if (userCheck.data) {
      return NextResponse.json(
        { error: 'An account already exists with this email' },
        { status: 400 }
      );
    }

    // Then check waitlist
    if (waitlistCheck.data) {
      return NextResponse.json(
        { error: 'Email already registered for waitlist' },
        { status: 400 }
      );
    }

    // If email doesn't exist in either table, proceed with Clerk waitlist
    const response = await fetch(
      'https://api.clerk.dev/v1/waitlist_entries',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          email_address: email,
          website: process.env.NEXT_PUBLIC_APP_URL
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Clerk API error:', data);
      return NextResponse.json(
        { error: data.errors?.[0]?.message || 'Failed to join waitlist' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined waitlist',
      data
    });

  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
} 