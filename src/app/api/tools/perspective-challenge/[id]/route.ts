import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 299; // Changed to 299 secs maximum

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    // Log all search params
    console.log("All search params:", Object.fromEntries(url.searchParams));

    const id =
      url.searchParams.get("id") || request.nextUrl.pathname.split("/").pop();

    const { data, error } = await supabase
      .from("perspective_challenge_results")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const url = new URL(request.url);
    // Log all search params
    console.log("All search params:", Object.fromEntries(url.searchParams));

    const id =
      url.searchParams.get("id") || request.nextUrl.pathname.split("/").pop();

    const { data, error } = await supabase
      .from("perspective_challenge_results")
      .update({
        input: body.perspective,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update analysis" },
      { status: 500 }
    );
  }
}
