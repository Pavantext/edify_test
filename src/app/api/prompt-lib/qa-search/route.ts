import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    // Authenticate user
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { query } = await req.json();
    const supabase = await createClient();

    // Fetch organization users
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId);

    if (orgUsersError) {
      console.error("Error fetching organization users:", orgUsersError);
      return NextResponse.json({ error: "Failed to fetch organization users" }, { status: 500 });
    }

    const userIdsToFetch = orgUsers.map((user: any) => user.user_id);

    // Fetch filtered results based on user organization
    const { data, error } = await supabase
      .from("long_qa_generator_results")
      .select(
        `
        id,
        input_topic,
        ai_generated_questions,
        created_at,
        complexity
      `
      )
      .or(
        `input_topic.ilike.%${query}%,ai_generated_questions->questions->>question.ilike.%${query}%`
      )
      .in("user_id", userIdsToFetch) // Ensuring only org users' data is retrieved
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching data:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      results:
        data?.map((item) => ({
          id: item.id,
          input_topic: item.input_topic,
          questions: item.ai_generated_questions.questions,
          createdAt: item.created_at,
          complexity: item.complexity,
        })) || [],
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
