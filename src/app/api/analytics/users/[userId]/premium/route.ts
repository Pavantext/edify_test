import { NextResponse } from "next/server"
import { createServiceClient } from "@/utils/supabase/service"
import { NextRequest } from "next/server"
import { auth, clerkClient } from '@clerk/nextjs/server'

interface Subscription {
  status: string
  seats?: number
}

interface Organization {
  id: string
  subscriptions: Subscription[]
}

interface OrgMembership {
  org_id: string
  created_at: string
  organization: Organization
}

type RouteParams = {
  params: Promise<{
    userId: string
  }>
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const supabase = createServiceClient()
    const { userId } = await params
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    let premium = false;
    const today = new Date().toISOString();

    // Check if admin has manually enabled premium for the user.
    const { data: userManual, error: userManualError } = await supabase
      .from("users")
      .select("premium")
      .eq("id", userId)
      .maybeSingle();

    if (userManualError) {
      console.error("Error fetching user manual premium flag:", userManualError);
      return NextResponse.json({ error: "Failed to fetch user info" }, { status: 500 });
    }

    if (userManual && userManual.premium === true) {
      premium = true;
    }

    // If still not premium, check for an active individual subscription.
    if (!premium) {
      const { data: indivSub, error: indivSubError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("current_period_end", today)
        .maybeSingle();

      if (indivSubError) {
        console.error("Error fetching individual subscription:", indivSubError);
        return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
      }

      if (indivSub) {
        premium = true;
      }
    }

    return NextResponse.json({ premium });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await params
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Get the current user's session
    const session = await auth()
    if (!session?.userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Check if the requesting user is an admin
    const clerk = await clerkClient()
    const currentUser = await clerk.users.getUser(session.userId)
    const isAdmin = currentUser.publicMetadata.role === 'admin'
    
    if (!isAdmin) {
      return new NextResponse("Unauthorized - Admin access required", { status: 403 })
    }

    const supabase = createServiceClient()
    const body = await req.json()
    const { premium } = body

    // Update user's premium status in Supabase
    const { data, error } = await supabase
      .from('users')
      .update({ premium })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return new NextResponse("Failed to update subscription", { status: 500 })
    }

    return NextResponse.json({ premium: data.premium })
  } catch (error) {
    console.error('[SUBSCRIPTION_UPDATE]', error)
    return new NextResponse("Internal Error", { status: 500 })
  }
} 
