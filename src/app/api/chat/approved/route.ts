import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";
import { createClient } from "@/utils/supabase/server";

type RouteParams = {
  params: Promise<{}>;
};

export async function POST(
    request: NextRequest,
    context: RouteParams
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, model, sessionId, messageId } = await request.json();

    if (!message || !model || !sessionId || !messageId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const startTime = Date.now();

    // 1. First update chat_sessions with the new message
    const { data: sessionData, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("messages")
      .eq("id", sessionId)
      .single();

    if (sessionError) {
      console.error("Error fetching session:", sessionError);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = [...(sessionData.messages || []), {
      id: messageId,
      role: "user",
      content: message,
      model: model,
      created_at: new Date().toISOString(),
      contentFlags: {
        moderator_approval: 'approved'
      }
    }];

    const { error: updateError } = await supabase
      .from("chat_sessions")
      .update({ messages })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Error updating session:", updateError);
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }

    // 2. Create entry in chat_metrics
    const { data: metricsData, error: metricsError } = await supabase
      .from("chat_metrics")
      .insert({
        user_id: userId,
        session_id: sessionId,
        model: model,
        input_length: message.length,
        response_length: 0,
        duration_ms: 0,
        prompt_text: message,
        content_flags: {
          pii_detected: false,
          bias_detected: false,
          content_violation: false,
          self_harm_detected: false,
          child_safety_violation: false,
          misinformation_detected: false,
          prompt_injection_detected: false,
          automation_misuse_detected: false,
          extremist_content_detected: false,
          fraudulent_intent_detected: false,
          moderator_approval: 'approved'
        }
      })
      .select()
      .single();

    if (metricsError) {
      console.error("Error creating metrics:", metricsError);
      return NextResponse.json({ error: "Failed to create metrics" }, { status: 500 });
    }

    // 3. Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: message }],
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        } finally {
          controller.close();
          
          // Update metrics after stream ends
          const duration = Date.now() - startTime;
          await supabase
            .from("chat_metrics")
            .update({
              duration_ms: duration,
              response_length: response.toString().length,
            })
            .eq("id", metricsData.id);
        }
      },
    });

    // Return the stream with appropriate headers
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Error in approved chat route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 