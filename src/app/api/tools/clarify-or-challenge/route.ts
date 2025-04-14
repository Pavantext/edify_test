import { calculateGBPPrice } from "@/lib/exchange-service";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const maxDuration = 299; // Changed to 299 secs maximum

const clarifySchema = {
  main_argument: { type: "string" },
  key_concepts: {
    type: "array",
    items: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
      },
    },
  },
  critical_details: {
    type: "array",
    items: { type: "string" },
  },
  applications_in_practice: {
    type: "array",
    items: {
      type: "object",
      properties: {
        example: { type: "string" },
        description: { type: "string" },
      },
    },
  },
};

const challengeSchema = {
  critical_reflection_questions: {
    type: "array",
    items: { type: "string" },
  },
  advanced_concepts: {
    type: "array",
    items: {
      type: "object",
      properties: {
        concept: { type: "string" },
        explanation: { type: "string" },
      },
    },
  },
  interdisciplinary_connections: {
    type: "array",
    items: {
      type: "object",
      properties: {
        field: { type: "string" },
        connection: { type: "string" },
      },
    },
  },
  counterarguments: {
    type: "array",
    items: { type: "string" },
  },
  future_challenges: {
    type: "array",
    items: { type: "string" },
  },
};

const getAudiencePrompt = (audience: string) => {
  switch (audience) {
    case "beginner":
      return "Explain concepts in simple terms, using basic vocabulary and clear examples. Avoid technical jargon and complex terminology.";
    case "advanced":
      return "Use sophisticated terminology and complex concepts. Include detailed technical explanations and advanced theoretical frameworks.";
    default: // intermediate
      return "Balance accessibility with depth. Use moderate technical language and provide both practical and theoretical insights.";
  }
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();
    const { type, inputText, audience = "intermediate" } = await req.json();

    let systemPrompt = "";
    if (type === "clarify") {
      systemPrompt = `You are an AI that creates structured breakdowns of complex topics. ${getAudiencePrompt(
        audience
      )} Output must exactly match this JSON schema: ${JSON.stringify(
        clarifySchema
      )}. Ensure the response is detailed but accessible. Use UK english only.`;
    } else {
      systemPrompt = `You are an AI that creates advanced analysis and challenging questions about topics. ${getAudiencePrompt(
        audience
      )} Output must exactly match this JSON schema: ${JSON.stringify(
        challengeSchema
      )}. Focus on thought-provoking and interdisciplinary perspectives. Use UK english only.`;
    }

    // Get approved ID from URL if present
    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approved");
    console.log("POST Request with approved ID:", approvedId);

    // Perform content checks only if we don't have an approved ID
    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      const result = await performContentChecks(inputText);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    } else {
      console.log("Skipping content checks due to approved ID");
      // For approved content, let's try to fetch the original metrics
      try {
        const { data: metricsData, error: metricsError } = await supabase
          .from("ai_tools_metrics")
          .select("*")
          .eq("id", approvedId)
          .single();

        if (metricsError || !metricsData) {
          console.log("Could not find metrics for approvedId:", approvedId, "Error:", metricsError?.message);
        } else {
          console.log("Found metrics for approvedId:", approvedId, "Prompt ID:", metricsData.prompt_id);
        }
      } catch (err) {
        console.error("Error checking metrics for approved ID:", err);
      }
    }

    if (!shouldProceed) {
      // Record the violations in the database

      const { data, error } = await supabase
        .from("clarify_or_challenge")
        .insert({
          type,
          user_id: userId,
          input_text: inputText,
          output_text: "",
          audience,
        })
        .select()
        .single();

      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: inputText.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "clarify_or_challenge",
        prompt_id: data.id,
        flagged: true,
      });

      // Get array of flagged violations
      const flaggedViolations = Object.entries(violations)
        .filter(([_, value]) => value === true)
        .map(([key]) => key.replace(/_/g, " "));

      const errorMessage =
        flaggedViolations.length === 1
          ? `This request violates ${flaggedViolations[0]}. Please review your input`
          : `This request violates ${flaggedViolations.join(
            ", "
          )}. Please review your input`;

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get previous feedback for similar content to improve response
    const { data: previousFeedback } = await supabase
      .from("clarify_or_challenge_feedback")
      .select("rating, feedback")
      .eq("type", type)
      .eq("audience", audience)
      .order("created_at", { ascending: false })
      .limit(5);

    // Incorporate feedback into the prompt if available
    if (previousFeedback && previousFeedback.length > 0) {
      const feedbackSummary = previousFeedback
        .map((f) => `Rating: ${f.rating}, Feedback: ${f.feedback}`)
        .join("\n");
      systemPrompt += `\n\nPrevious feedback to consider:\n${feedbackSummary}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText },
      ],
    });

    // Parse the completion content
    const outputContent = completion.choices[0].message.content || "{}";
    console.log("Raw output from OpenAI:", outputContent.substring(0, 100) + "...");

    // For consistency, store output as a string, not parsed JSON
    const { data, error } = await supabase
      .from("clarify_or_challenge")
      .insert({
        type,
        user_id: userId,
        input_text: inputText,
        output_text: outputContent, // Store as string, not parsed JSON
        audience,
      })
      .select()
      .single();

    if (error) throw error;
    console.log("Saved to database with ID:", data.id);

    const price = await calculateGBPPrice(
      completion.usage?.prompt_tokens || 0,
      completion.usage?.prompt_tokens || 0,
      "gpt-4o"
    );

    await recordAIToolsMetrics({
      userId: userId!,
      model: "gpt-4o",
      input_length: (systemPrompt + inputText).length,
      response_length: completion.choices[0].message.content?.length || 0,
      startTime: new Date(),
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "clarify_or_challenge",
      prompt_id: data.id,
      flagged: false,
      status_code: 200,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}

// Add GET endpoint to retrieve approved clarify/challenge content
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approved");

    if (!approvedId) {
      return NextResponse.json(
        { error: "Invalid approved ID" },
        { status: 400 }
      );
    }

    // First get the metrics record to get the actual content ID
    const { data: metricsData, error: metricsError } = await supabase
      .from("ai_tools_metrics")
      .select("*")
      .eq("id", approvedId)
      .single();

    if (metricsError || !metricsData) {
      return NextResponse.json(
        {
          error: "Failed to retrieve metrics",
          message: metricsError?.message || "Metrics not found",
        },
        { status: 404 }
      );
    }

    // Check if content is approved
    if (metricsData.moderator_approval !== 'approved') {
      return NextResponse.json(
        {
          error: "Content not approved",
          details: {
            status: metricsData.moderator_approval,
            contentFlags: metricsData.content_flags
          }
        },
        { status: 403 }
      );
    }

    // Then get the actual content using the prompt_id from metrics
    const { data: contentData, error: contentError } = await supabase
      .from("clarify_or_challenge")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (contentError || !contentData) {
      return NextResponse.json(
        {
          error: "Failed to retrieve content",
          message: contentError?.message || "Content not found",
        },
        { status: 404 }
      );
    }

    // Ensure we have valid output_text
    let parsedOutput = contentData.output_text;

    // If output_text is empty string or null/undefined, provide an empty object
    if (!parsedOutput || (typeof parsedOutput === 'string' && parsedOutput.trim() === '')) {
      parsedOutput = {};
    }

    // If it's already a string, we keep it as is to be parsed client-side
    // If it's an object (from the database), we keep it as is

    return NextResponse.json({
      id: contentData.id,
      type: contentData.type,
      input_text: contentData.input_text,
      output_text: parsedOutput,
      audience: contentData.audience,
      created_at: contentData.created_at,
      metadata: {
        moderator_approval: metricsData.moderator_approval
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
