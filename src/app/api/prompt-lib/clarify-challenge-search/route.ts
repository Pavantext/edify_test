import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/client";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
    try {
        const { query } = await req.json();
        const supabase = createClient();
        const { userId, orgId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        // Fetch organization members
        const { data: orgUsers, error: orgUsersError } = await supabase
            .from("org_members")
            .select("user_id")
            .eq("org_id", orgId);

        if (orgUsersError) {
            console.error("Error fetching organization users:", orgUsersError);
            return NextResponse.json(
                { error: "Failed to fetch organization users" },
                { status: 500 }
            );
        }

        const userIdsToFetch = orgUsers.map((user: any) => user.user_id);

        // Search within the allowed organization members
        const { data, error } = await supabase
            .from("clarify_or_challenge")
            .select("*")
            .in("user_id", userIdsToFetch)
            .ilike("input_text", `%${query}%`)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error("Error fetching data:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const results = data?.map(item => ({
            id: item.id,
            type: item.type,
            input_text: item.input_text,
            output_text: item.output_text,
            createdAt: item.created_at,
            audience: item.audience,
            complexity: item.complexity
        })) || [];

        return NextResponse.json({ results });
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
