import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

// Define response type
type SubjectsResponse = {
  subjects: string[];
} | {
  error: string;
};

// GET handler
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return Response.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    return Response.json({ 
      subjects: user.unsafeMetadata?.subjects || [] 
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}

// PUT handler
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const { userId, subjects } = await request.json();
    
    if (!userId) {
      return Response.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const clerk = await clerkClient();
    await clerk.users.updateUser(userId, {
      unsafeMetadata: { subjects }
    });
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: "Failed to update subjects" },
      { status: 500 }
    );
  }
}
