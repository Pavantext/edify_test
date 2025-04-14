import { createServiceClient } from "@/utils/supabase/service";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    if (user.publicMetadata?.role !== 'support') {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { ticketId } = await params;
    const body = await request.json();
    
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('tickets')
      .update({
        status: body.status,
        priority: body.priority,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 