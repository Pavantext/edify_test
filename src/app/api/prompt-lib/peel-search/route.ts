import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  console.log("Received a POST request");

  const { query } = await req.json();
  console.log("Search query:", query);

  try {
    const { userId, orgId } = await auth();
    console.log("Authenticated user:", userId, "Organization ID:", orgId);

    if (!userId) {
      console.error("Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const supabase = await createClient();
    console.log("Supabase client initialized");

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

    console.log("Fetched organization users:", orgUsers);
    const userIdsToFetch = orgUsers.map((user: any) => user.user_id);

    const { data, error } = await supabase
      .from("peel_generator_results")
      .select(
        `
        id,
        topic,
        subject,
        complexity,
        created_at,
        tone,
        audience,
        word_count_range,
        user_id,
        peel_content
      `
      )
      .textSearch("topic", query, {
        type: "websearch",
        config: "english",
      })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error searching PEEL results:", error);
      throw error;
    }

    // Log the raw fetched PEEL result
    console.log("Raw fetched PEEL result:", JSON.stringify(data, null, 2));

    const filteredResults = data
      .filter((item: any) => userIdsToFetch.includes(item.user_id))
      .map((item: any) => {
        const peelContent = item.peel_content as PeelContent;
        const feedback = peelContent.feedback as Feedback;

        return {
          id: item.id,
          topic: item.topic,
          subject: item.subject,
          complexity: item.complexity,
          createdAt: item.created_at,
          tone: item.tone,
          audience: item.audience,
          wordCountRange: item.word_count_range,
          userId: item.user_id,
          peelContent: peelContent,
          point: peelContent?.point,
          evidence: peelContent?.evidence,
          explanation: peelContent?.explanation,
          link: peelContent?.link,
          feedback: feedback
            ? {
                strengths: feedback?.strengths,
                improvements: feedback?.improvements,
              }
            : null,
        };
      });

    return NextResponse.json({
      results: filteredResults,
    });
    
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to search PEEL results" },
      { status: 500 }
    );
  }
}

export interface Feedback {
  strengths: string;
  improvements: string;
}

export interface PeelContent {
  link: string;
  point: string;
  evidence: string;
  feedback: Feedback;
  explanation: string;
}