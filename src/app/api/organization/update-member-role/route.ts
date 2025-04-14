import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    const { userId: targetUserId, role, organizationId } = await req.json();

    if (!userId || !targetUserId || !organizationId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Get organization membership for the current user
    const membershipResponse = await fetch(
      `https://api.clerk.com/v1/organizations/${organizationId}/memberships`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );
    const { memberships } = await membershipResponse.json();
    
    // Check if current user is an admin of the organization
    const currentUserMembership = memberships.find(
      (m: any) => m.public_user_data.user_id === userId
    );
    
    if (currentUserMembership?.role !== 'admin') {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Update target user's role in the organization
    await fetch(
      `https://api.clerk.com/v1/organizations/${organizationId}/memberships/${targetUserId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role
        })
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}