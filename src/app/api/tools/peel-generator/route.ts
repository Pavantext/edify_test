import { calculateGBPPrice } from "@/lib/exchange-service";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

interface PEELRequest {
  topic: string;
  subject?: string;
  complexity?: string;
}

interface PEELContent {
  point: string;
  evidence: string;
  explanation: string;
  link: string;
}

interface PEELResponse {
  content: PEELContent;
  metadata: {
    subject?: string;
    complexity?: string;
    timestamp: string;
  };
}

interface PEELRequest {
  topic: string;
  subject?: string;
  complexity?: string;
  tone?: string; // New field
  audience?: string; // New field
  wordCountRange?: { min: number; max: number }; // New field
}

export const maxDuration = 299; // Changed to 299 secs maximum

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();
    const body: PEELRequest = await req.json();

    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approvedId");

    // Skip topic validation if an approved ID is provided
    if (!approvedId && !body.topic) {
      return NextResponse.json(
        { error: "Missing required fields: topic" },
        { status: 400 }
      );
    }

    // Validate wordCountRange if provided
    if (
      body.wordCountRange &&
      (typeof body.wordCountRange.min !== "number" ||
        typeof body.wordCountRange.max !== "number")
    ) {
      return NextResponse.json(
        { error: "Invalid word count range format" },
        { status: 400 }
      );
    }

    const targetWordCount = body.wordCountRange
      ? Math.floor((body.wordCountRange.max + body.wordCountRange.min) / 2)
      : 500;

    const systemMessage = `Generate a well-structured PEEL paragraph about the following topic: ${
      body.topic
    }.
    The paragraph must strictly adhere to a word count between ${
      body.wordCountRange?.min
    } and ${body.wordCountRange?.max} words. This is a critical requirement.
    ${body.subject ? `Subject area: ${body.subject}` : ""}
    ${body.complexity ? `Complexity level: ${body.complexity}` : ""}
    ${body.tone ? `Tone: ${body.tone}` : ""}
    ${body.audience ? `Target audience: ${body.audience}` : ""}
    
    Return a JSON object with these exact keys:
    {
      "point": "A clear statement of the main idea or argument in detail",
      "evidence": "Specific examples, data, or quotes that support the point in detail",
      "explanation": "Analysis of how the evidence supports the point in detail and in bullet points",
      "link": "A connection back to the main argument or transition to the next paragraph",
      "feedback": {
        "strengths": "List of strengths in the paragraph in detail",
        "improvements": "List of areas for improvement in detail"
      }
    }
.`;
    console.log("System Message", systemMessage);

    // Perform content checks
    // const { violations, shouldProceed } = await performContentChecks(
    //   systemMessage
    // );

    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      // Only perform content checks if we don't have an approved ID
      const result = await performContentChecks(body.topic);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed) {
      const { data, error } = await supabase
        .from("peel_generator_results")
        .insert({
          user_id: userId,
          topic: body.topic,
          subject: body.subject,
          complexity: body.complexity,
          tone: body.tone,
          audience: body.audience,
          word_count_range: body.wordCountRange,
          peel_content: "",
        })
        .select()
        .single();
      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: systemMessage.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        contentFlags: violations as any,
        error_type: "content_violation",
        status_code: 400,
        prompt_type: "peel_generator",
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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Use UK English only and avoid convoluted language. " +
            "The paragraph must strictly adhere to a word count between " +
            body.wordCountRange?.min +
            " and " +
            body.wordCountRange?.max +
            " words. This is a critical requirement. Count words carefully in your response before returning it. A word is defined as any sequence of characters separated by spaces." +
            systemMessage,
        },
      ],
      response_format: { type: "json_object" },
    });

    // Extract and validate the content
    let peelContent = JSON.parse(
      completion.choices[0].message.content!
    ) as PEELContent;

    // Validate word count if range is specified
    if (body.wordCountRange) {
      let totalWords = [
        peelContent.point,
        peelContent.evidence,
        peelContent.explanation,
        peelContent.link,
      ]
        .join(" ")
        .split(/\s+/)
        .filter((word) => word.length > 0).length;

      console.log("Total words in generated content:", totalWords);
      console.log(
        "Required range:",
        body.wordCountRange.min,
        "-",
        body.wordCountRange.max
      );

      // If word count is out of range, request a re-generation
      if (
        totalWords < body.wordCountRange.min ||
        totalWords > body.wordCountRange.max
      ) {
        console.warn("Word count mismatch. Requesting re-generation.");
        const feedback =
          totalWords < body.wordCountRange.min
            ? "The content is too short. Please add more details to meet the word count requirement."
            : "The content is too long. Please condense the details to meet the word count requirement.";

        // Re-call OpenAI API to regenerate content with feedback
        const retryCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "Use UK English only and avoid convoluted language. " +
                "The paragraph must strictly adhere to a word count between " +
                body.wordCountRange?.min +
                " and " +
                body.wordCountRange?.max +
                " words. This is a critical requirement. Count words carefully in your response before returning it. A word is defined as any sequence of characters separated by spaces." +
                systemMessage,
            },
            {
              role: "user",
              content:
                "The previous content was: " +
                JSON.stringify(peelContent) +
                ". " +
                feedback,
            },
          ],
          response_format: { type: "json_object" },
        });

        // Extract and validate the new content
        peelContent = JSON.parse(
          retryCompletion.choices[0].message.content!
        ) as PEELContent;
      }
    }

    // Store in Supabase
    const { data, error } = await supabase
      .from("peel_generator_results")
      .insert({
        user_id: userId,
        topic: body.topic,
        subject: body.subject,
        complexity: body.complexity,
        tone: body.tone,
        audience: body.audience,
        word_count_range: body.wordCountRange,
        peel_content: peelContent,
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to store results" },
        { status: 500 }
      );
    }

    // Calculate pricing
    const price = await calculateGBPPrice(
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0,
      "gpt-4o"
    );

    // Record metrics
    await recordAIToolsMetrics({
      userId: userId!,
      model: "gpt-4o",
      input_length: systemMessage.length,
      response_length: completion.choices[0].message.content?.length || 0,
      startTime: new Date(),
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "peel_generator",
      prompt_id: data.id,
      flagged: false,
      status_code: 200,
    });

    const response: PEELResponse = {
      content: peelContent,
      metadata: {
        subject: body.subject,
        complexity: body.complexity,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json({ data: data }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approved") || searchParams.get("id"); // Support both parameter names

    if (!approvedId) {
      return NextResponse.json(
        { error: "Invalid approved ID" },
        { status: 400 }
      );
    }

    // First get the metrics record to get the actual peel generator ID
    const { data: metricsData, error: metricsError } = await supabase
      .from("ai_tools_metrics")
      .select("*")
      .eq("id", approvedId)
      .single();

    if (metricsError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve metrics",
          message: metricsError.message,
        },
        { status: 404 }
      );
    }

    if (!metricsData) {
      return NextResponse.json(
        { error: "Metrics not found" },
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

    // Then get the actual peel generator data using the prompt_id from metrics
    const { data: peelData, error: peelError } = await supabase
      .from("peel_generator_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (peelError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve peel data",
          message: peelError.message,
        },
        { status: 404 }
      );
    }

    if (!peelData) {
      return NextResponse.json(
        { error: "Peel data not found" },
        { status: 404 }
      );
    }

    let peelContent;
    try {
      // Check if the peel content is empty or null
      if (!peelData.peel_content || peelData.peel_content === '') {
        return NextResponse.json({
          content: null,
          input_data: {
            topic: peelData.topic,
            subject: peelData.subject,
            complexity: peelData.complexity,
            tone: peelData.tone,
            audience: peelData.audience,
            word_count_range: peelData.word_count_range
          },
          metadata: {
            id: peelData.id,
            created_at: peelData.created_at,
            moderator_approval: metricsData.moderator_approval
          }
        });
      }

      // Handle string or object format for peelData.peel_content
      if (typeof peelData.peel_content === 'string') {
        try {
          peelContent = JSON.parse(peelData.peel_content);
        } catch (e) {
          peelContent = peelData.peel_content;
        }
      } else {
        peelContent = peelData.peel_content;
      }
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid peel data format",
          message: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 500 }
      );
    }

    const response = {
      content: peelContent,
      input_data: {
        topic: peelData.topic,
        subject: peelData.subject,
        complexity: peelData.complexity,
        tone: peelData.tone,
        audience: peelData.audience,
        word_count_range: peelData.word_count_range
      },
      metadata: {
        id: peelData.id,
        created_at: peelData.created_at,
        moderator_approval: metricsData.moderator_approval
      },
    };

    return NextResponse.json(response);
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
