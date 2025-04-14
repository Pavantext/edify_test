import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      console.error("[Rubric Search] Unauthorized access attempt");
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

    console.log("[Rubric Search] User ID:", userId);
    console.log("[Rubric Search] Query:", query);

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

    // Main query for rubrics within the organization
    const { data, error } = await supabase
      .from("rubrics_generator_results")
      .select(`
        id,
        assignment_type,
        key_stage,
        year_group,
        assessment_type,
        ai_response,
        created_at,
        topic
      `)
      .or(`topic.ilike.%${query}%,document_text.ilike.%${query}%`)
      .in("user_id", userIdsToFetch) // Restricting results to the organization
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Rubric Search] Database Error:", error);
      return NextResponse.json(
        { error: "Database query failed" },
        { status: 500 }
      );
    }

    const transformedResults = data?.map(item => {
      try {
        return {
          id: item.id,
          type: "rubric",
          assessment_type: item.assessment_type,
          key_stage: item.key_stage,
          year_group: item.year_group,
          ai_response: typeof item.ai_response === "string" 
            ? JSON.parse(item.ai_response)
            : item.ai_response,
          created_at: new Date(item.created_at).toISOString(),
          topic: item.topic,
          questions: [],
          questions_data: []
        };
      } catch (parseError) {
        console.error("[Rubric Search] AI Response Parse Error:", parseError);
        return null;
      }
    }).filter(Boolean) || [];

    console.log("[Rubric Search] Transformed Results:", transformedResults);

    return NextResponse.json({ results: transformedResults });

  } catch (error) {
    console.error("[Rubric Search] Critical Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
