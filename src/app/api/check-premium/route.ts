import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/utils/supabase/service";
import { PROMPT_LIMITS } from "@/constants/prompt-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
    try {
        const supabase = await createServiceClient();
        const { userId, orgId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        let premium = false;
        const today = new Date().toISOString();

        // --- Organization Flow ---
        if (orgId) {
            // First, check if admin manually enabled premium for the organization.
            const { data: orgManual, error: orgManualError } = await supabase
                .from("organizations")
                .select("premium")
                .eq("id", orgId)
                .maybeSingle();

            if (orgManualError) {
                console.error("Error fetching organization manual premium flag:", orgManualError);
                return NextResponse.json({ error: "Failed to fetch organization info" }, { status: 500 });
            }

            // Check for active subscription
            const { data: orgSub, error: orgSubError } = await supabase
                .from("subscriptions")
                .select("*")
                .eq("organization_id", orgId)
                .eq("status", "active")
                .gt("current_period_end", today)
                .maybeSingle();

            if (orgSubError) {
                console.error("Error fetching organization subscription:", orgSubError);
                return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
            }

            // Premium is true if manually set or has an active subscription
            premium = (orgManual && orgManual.premium === true) || !!orgSub;

            // If not premium, check usage limit
            if (!premium) {
                // Fetch all organization members.
                const { data: members, error: membersError } = await supabase
                    .from("org_members")
                    .select("user_id")
                    .eq("org_id", orgId);

                if (membersError) {
                    console.error("Error fetching organization members:", membersError);
                    return NextResponse.json({ error: "Failed to fetch organization members" }, { status: 500 });
                }

                // Count usage for all organization members.
                const memberIds = members.map((member: any) => member.user_id);
                const { count: usageCount, error: countError } = await supabase
                    .from("ai_tools_metrics")
                    .select("*", { count: "exact", head: true })
                    .in("user_id", memberIds);

                if (countError) {
                    console.error("Error fetching AI tools metrics count:", countError);
                    return NextResponse.json({ error: "Failed to fetch usage metrics" }, { status: 500 });
                }

                const countValue = usageCount ?? 0;
                if (countValue >= PROMPT_LIMITS.organization) {
                    // Usage limit exceeded.
                    return NextResponse.json({ premium, usageExceeded: true });
                }
            }
        }
        // --- Individual Flow ---
        else {
            // Check if admin manually enabled premium for the user.
            const { data: userManual, error: userManualError } = await supabase
                .from("users")
                .select("premium")
                .eq("id", userId)
                .maybeSingle();

            if (userManualError) {
                console.error("Error fetching user manual premium flag:", userManualError);
                return NextResponse.json({ error: "Failed to fetch user info" }, { status: 500 });
            }

            // Check for active individual subscription
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

            // Premium is true if manually set or has an active subscription
            premium = (userManual && userManual.premium === true) || !!indivSub;

            // If not premium, check usage limit
            if (!premium) {
                const { count: usageCount, error: countError } = await supabase
                    .from("ai_tools_metrics")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", userId);

                if (countError) {
                    console.error("Error fetching AI tools metrics count:", countError);
                    return NextResponse.json({ error: "Failed to fetch usage metrics" }, { status: 500 });
                }

                const countValue = usageCount ?? 0;
                if (countValue >= PROMPT_LIMITS.individual) {
                    // Usage limit exceeded.
                    return NextResponse.json({ premium, usageExceeded: true });
                }
            }
        }

        // If premium or prompt usage is within limit, return accordingly.
        return NextResponse.json({ premium, usageExceeded: false });
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
