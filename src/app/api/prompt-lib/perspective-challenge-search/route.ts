import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/client";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    const supabase = createClient();
    const { query } = await req.json();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { data, error } = await supabase
      .from("perspective_challenge_results")
      .select("id, input, analysis, created_at, user_id")
      .in("user_id", userIdsToFetch)
      .ilike("input", `%${query}%`)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Add JSON validation
    const transformed = data?.map(item => ({
      id: item.id,
      type: "perspective",
      input: item.input,
      analysis: item.analysis ? JSON.parse(JSON.stringify(item.analysis)) : null,
      createdAt: item.created_at
    })) || [];

    console.log('Raw DB analysis data:', data?.[0]?.analysis);
    console.log('Transformed analysis:', transformed?.[0]?.analysis);

    return NextResponse.json({ results: transformed });

  } catch (error) {
    console.error("Perspective challenge search error:", error);
    return NextResponse.json(
      { error: "Failed to search perspective challenges" },
      { status: 500 }
    );
  }
}
