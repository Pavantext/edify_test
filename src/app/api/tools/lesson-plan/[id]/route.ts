import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

// export const dynamic = "force-dynamic";
export const maxDuration = 299; // Changed to 299 secs maximum

export async function GET(
  request: NextRequest,
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const id =
      url.searchParams.get("id") || request.nextUrl.pathname.split("/").pop();

    const supabase = await createClient();
    const { data: result, error } = await supabase
      .from("lesson_plan_results")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !result) {
      return new NextResponse(
        JSON.stringify({
          error: "Lesson plan not found",
        }),
        { status: 404 }
      );
    }

    const lessonPlan = JSON.parse(result.ai_lesson_plan);
    return NextResponse.json({
      ...result,
      ai_lesson_plan: lessonPlan
    });
  } catch (error) {
    console.error("Error fetching lesson plan:", error);
    return new NextResponse(
      JSON.stringify({
        error: "Failed to fetch lesson plan",
      }),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(request.url);
    const id =
      url.searchParams.get("id") || request.nextUrl.pathname.split("/").pop();


    const body = await request.json();

    const supabase = await createClient();
    const { data: result, error } = await supabase
      .from("lesson_plan_results")
      .update({
        ai_lesson_plan: JSON.stringify(body),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating lesson plan:", error);
    return new NextResponse(
      JSON.stringify({
        error: "Failed to update lesson plan",
      }),
      { status: 500 }
    );
  }
}