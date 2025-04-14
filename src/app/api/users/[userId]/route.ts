import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: RouteParams
) {
  try {
    const clerk = await clerkClient();
    const { userId } = await params;
    const user = await clerk.users.getUser(userId);

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        imageUrl: user.imageUrl,
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}