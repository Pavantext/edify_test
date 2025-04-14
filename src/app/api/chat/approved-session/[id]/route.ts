import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Define the params type
type RouteParams = {
  params: Promise<{
    id: string
  }>
}

export async function GET(
    request: NextRequest,
    { params }: RouteParams
): Promise<NextResponse> {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const supabase = await createClient();

        // 1. First get the chat metric details using the ID directly
        const { data: chatMetric, error: chatMetricError } = await supabase
            .from('chat_metrics')
            .select('id, session_id, prompt_text, user_id')
            .eq('id', id)
            .single();

        if (chatMetricError || !chatMetric) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        // 2. Then get the approval status from ai_tools_metrics using chat_metrics.id as prompt_id
        const { data: approvalStatus, error: approvalError } = await supabase
            .from('ai_tools_metrics')
            .select('moderator_approval')
            .eq('prompt_id', chatMetric.id)
            .single();

        if (approvalError || !approvalStatus) {
            return NextResponse.json({ error: "Approval status not found" }, { status: 404 });
        }

        // Verify this content is approved and belongs to the user
        if (approvalStatus.moderator_approval !== 'approved') {
            return NextResponse.json({ error: "Content not approved" }, { status: 403 });
        }

        if (chatMetric.user_id !== userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
        }

        // 3. Get the full chat session
        const { data: session, error: sessionError } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('id', chatMetric.session_id)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // 4. Return the session data with approved prompt details
        return NextResponse.json({
            success: true,
            data: {
                session,
                approvedPromptId: chatMetric.id,
                promptText: chatMetric.prompt_text,
                metricsId: id
            }
        });

    } catch (error) {
        console.error("Error fetching approved session:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
} 