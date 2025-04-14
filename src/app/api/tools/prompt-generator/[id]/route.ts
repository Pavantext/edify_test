import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 299; // Changed to 299 secs maximum

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Log the full request URL for debugging
    console.log("Request URL:", request);

    const url = new URL(request.url);
    // Log all search params
    console.log("All search params:", Object.fromEntries(url.searchParams));

    const id =
      url.searchParams.get("id") || request.nextUrl.pathname.split("/").pop();
    // Log the extracted ID
    console.log("Extracted ID:", id);

    // Add validation for missing ID
    if (!id) {
      return NextResponse.json(
        { error: "ID parameter is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("prompt_generator_results")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to generate prompts" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const body = await request.json();
    console.log("Request URL:", request);

    const url = new URL(request.url);
    // Log all search params
    console.log("All search params:", Object.fromEntries(url.searchParams));

    const id =
      url.searchParams.get("id") || request.nextUrl.pathname.split("/").pop();

    // Validate the request body
    if (!body.ai_refined_prompts) {
      return NextResponse.json(
        { error: "ai_refined_prompts is required" },
        { status: 400 }
      );
    }

    // Update the refined prompts in the database
    const { data, error } = await supabase
      .from("prompt_generator_results")
      .update({ ai_refined_prompts: body.ai_refined_prompts })
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to generate prompts" },
      { status: 500 }
    );
  }
}
