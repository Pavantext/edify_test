import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Invalid search query" },
        { status: 400 }
      );
    }

    console.log("Searching for:", query);

    // Fetch organization members
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId);

    if (orgUsersError) {
      console.error("Error fetching organization users:", orgUsersError);
      return NextResponse.json({ error: "Failed to fetch organization users" }, { status: 500 });
    }

    const userIdsToFetch = orgUsers.map((user: any) => user.user_id);

    // Fetch quiz results only for users in the same organization
    const { data, error } = await supabase
      .from("quiz_generator_results")
      .select("id, topic, quiz_data, created_at")
      .or(`topic.ilike.%${query}%,quiz_data->metadata->>title.ilike.%${query}%`)
      .in("user_id", userIdsToFetch) // Ensuring only org users' data is retrieved
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[QUIZ_SEARCH] Database error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    console.log("Search results:", data);

    return NextResponse.json({
      results:
        data?.map((item: any) => ({
          id: item.id,
          type: "quiz",
          topic: item.topic,
          createdAt: item.created_at,
          quiz_data: item.quiz_data,
        })) || [],
    });
  } catch (error) {
    console.error("[QUIZ_SEARCH] Critical error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
