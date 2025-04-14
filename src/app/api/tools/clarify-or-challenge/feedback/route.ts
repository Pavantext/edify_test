import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();
    const body = await req.json();
    console.log('Received feedback request:', { userId, body });

    const { outputId, rating, feedback } = body;

    if (!outputId || !rating || !feedback) {
      console.error('Missing required fields:', { outputId, rating, feedback });
      return NextResponse.json(
        { error: "Missing required fields", received: { outputId, rating, feedback } },
        { status: 400 }
      );
    }

    // Update the existing record with feedback
    const { data, error: updateError } = await supabase
      .from("clarify_or_challenge")
      .update({
        rating,
        feedback
      })
      .eq('id', outputId)
      .eq('user_id', userId) // Ensure user can only update their own records
      .select()
      .single();

    if (updateError) {
      console.error('Error updating feedback:', updateError);
      return NextResponse.json(
        { error: "Failed to store feedback", details: updateError },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('No record found to update:', outputId);
      return NextResponse.json(
        { error: "Record not found or unauthorized" },
        { status: 404 }
      );
    }

    console.log('Successfully stored feedback:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error in feedback endpoint:', error);
    return NextResponse.json(
      { error: "Failed to submit feedback", details: error },
      { status: 500 }
    );
  }
} 