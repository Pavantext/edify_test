import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  console.log('=== WAITLIST API START ===');
  try {
    const body = await req.json();
    console.log('1. Received request body:', body);

    const { email } = body;
    if (!email) {
      console.log('2. No email provided');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Create waitlist entry in Clerk
    const clerk = await clerkClient();
    await clerk.allowlistIdentifiers.createAllowlistIdentifier({
      identifier: email,
      notify: true
    });

    console.log('3. Successfully created Clerk waitlist entry');
    console.log('=== WAITLIST API END ===');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully joined waitlist'
    });

  } catch (error) {
    console.error('ERROR in waitlist API:', error);
    console.log('=== WAITLIST API ERROR END ===');
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
} 