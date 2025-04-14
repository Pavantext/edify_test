import { calculateGBPPrice } from "@/lib/exchange-service";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email-service";

export const maxDuration = 299; // Changed to 299 secs maximum

// Type definitions
interface AnalysisStructure {
  mainPoints: {
    mainArgument: string;
    keyPoints: string[];
    implicitAssumptions: string[];
  };
  alternativePerspectives: {
    title: string;
    points: string[];
  }[];
  evidenceExploration: {
    supporting: string[];
    challenging: string[];
    researchQuestions: string[];
  };
  biasAssessment: {
    potentialBiases: string[];
    reductionSuggestions: string[];
  };
  adaptabilitySuggestions: string[];
}

interface ContentCheckResult {
  violations: {
    pii_detected?: boolean;
    content_violation?: boolean;
    bias_detected?: boolean;
    prompt_injection_detected?: boolean;
    fraudulent_intent_detected?: boolean;
    misinformation_detected?: boolean;
    self_harm_detected?: boolean;
    extremist_content_detected?: boolean;
    child_safety_violation?: boolean;
    automation_misuse_detected?: boolean;
  };
  shouldProceed: boolean;
  moderationResult?: {
    content_violation?: boolean;
    self_harm_detected?: boolean;
    misinformation_detected?: boolean;
    automation_misuse_detected?: boolean;
  };
}

// Example schema to guide the AI response
const exampleSchema = {
  mainPoints: {
    mainArgument:
      "Renewable energy transition is crucial for environmental sustainability",
    keyPoints: [
      "Reduces greenhouse gas emissions",
      "Provides energy independence",
      "Creates new job opportunities",
    ],
    implicitAssumptions: [
      "Technology is sufficiently advanced",
      "Implementation is economically viable",
      "Public support exists",
    ],
  },
  alternativePerspectives: [
    {
      title: "Economic Challenges",
      points: [
        "High initial infrastructure costs",
        "Impact on existing energy sector jobs",
        "Market readiness concerns",
      ],
    },
  ],
  evidenceExploration: {
    supporting: [
      "Declining renewable energy costs",
      "Successful implementations in Denmark",
      "Job growth in green sectors",
    ],
    challenging: [
      "Grid stability issues",
      "Resource limitations",
      "Geographic constraints",
    ],
    researchQuestions: [
      "How can we ensure energy security?",
      "What policy frameworks are needed?",
      "How to address technological gaps?",
    ],
  },
  biasAssessment: {
    potentialBiases: [
      "Technology optimism bias",
      "Environmental urgency bias",
      "Economic oversimplification",
    ],
    reductionSuggestions: [
      "Consider multiple transition scenarios",
      "Incorporate diverse stakeholder perspectives",
      "Analyse full lifecycle impacts",
    ],
  },
  adaptabilitySuggestions: [
    "Develop flexible implementation frameworks",
    "Create regional adaptation strategies",
    "Establish monitoring and adjustment mechanisms",
  ],
};

const systemPrompt = `Use UK english only and do not use convoluted language. You are an expert analysis system that evaluates perspectives on various topics. 
Your task is to provide a structured analysis following the exact schema provided.
Your analysis should be thorough, balanced, and evidence-based.

Important guidelines:
1. Follow the exact structure of the schema
2. Provide specific, concrete points rather than general statements
3. Consider multiple viewpoints and potential biases
4. Base analysis on logical reasoning and available evidence
5. Maintain objectivity while acknowledging uncertainties

Response must be valid JSON matching this exact structure:
${JSON.stringify(exampleSchema, null, 2)}`;

const generateUserPrompt = (perspective: string) => {
  return `Analyse the following perspective ${perspective}:

Provide a comprehensive analysis that includes:
1. Main argument and key supporting points
2. Implicit assumptions
3. Alternative perspectives and challenges
4. Evidence-based exploration (supporting and challenging)
5. Potential biases and suggestions for reduction
6. Adaptability suggestions

Format your response as JSON matching the provided schema exactly.`;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();
    const { perspective, regenerate, approvedId } = await request.json();

    if (!perspective) {
      return NextResponse.json(
        { error: "Topic and perspective are required" },
        { status: 400 }
      );
    }

    // Skip content checks if we have an approved ID
    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      // Only perform content checks if we don't have an approved ID
      const result = await performContentChecks(perspective);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed && !approvedId) {
      const { data, error } = await supabase
        .from("perspective_challenge_results")
        .insert([
          {
            user_id: userId,
            input: perspective,
            analysis: "",
          },
        ])
        .select()
        .single();

      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: perspective.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "perspective_challenge",
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

    // If we have an approved ID, fetch the existing analysis
    if (approvedId) {
      const { data: metricsData, error: metricsError } = await supabase
        .from("ai_tools_metrics")
        .select("*")
        .eq("id", approvedId)
        .single();

      if (metricsError || !metricsData) {
        return NextResponse.json(
          { error: "Failed to retrieve approved content" },
          { status: 404 }
        );
      }

      // Generate analysis using OpenAI for the approved content
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: generateUserPrompt(perspective) },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      });

      // Parse the response
      const analysisResult = JSON.parse(
        completion.choices[0].message.content || "{}"
      ) as any;

      // Store in Supabase
      const { data, error } = await supabase
        .from("perspective_challenge_results")
        .insert([
          {
            user_id: userId,
            input: perspective,
            analysis: analysisResult,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      const price = await calculateGBPPrice(
        completion.usage?.prompt_tokens || 0,
        completion.usage?.prompt_tokens || 0,
        "gpt-4o"
      );

      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: perspective.length,
        response_length: completion.choices[0].message.content?.length || 0,
        startTime: new Date(),
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        price_gbp: price,
        contentFlags: violations as any,
        prompt_type: "perspective_challenge",
        prompt_id: data.id,
        flagged: false,
        status_code: 200,
      });

      return NextResponse.json(data);
    }

    // Generate analysis using OpenAI for non-approved content
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: generateUserPrompt(perspective) },
      ],
      temperature: regenerate ? 0.8 : 0,
      response_format: { type: "json_object" },
    });

    // Parse the response
    const analysisResult = JSON.parse(
      completion.choices[0].message.content || "{}"
    ) as any;

    // Store in Supabase
    const { data, error } = await supabase
      .from("perspective_challenge_results")
      .insert([
        {
          user_id: userId,
          input: perspective,
          analysis: analysisResult,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    const price = await calculateGBPPrice(
      completion.usage?.prompt_tokens || 0,
      completion.usage?.prompt_tokens || 0,
      "gpt-4o"
    );

    await recordAIToolsMetrics({
      userId: userId!,
      model: "gpt-4o",
      input_length: perspective.length,
      response_length: completion.choices[0].message.content?.length || 0,
      startTime: new Date(),
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "perspective_challenge",
      prompt_id: data.id,
      flagged: false,
      status_code: 200,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to generate analysis" },
      { status: 500 }
    );
  }
}

// Add GET endpoint to handle approved content
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const approvedId = searchParams.get("approved") || searchParams.get("id");

    if (!approvedId) {
      return NextResponse.json(
        { error: "Invalid approved ID" },
        { status: 400 }
      );
    }

    // First get the metrics record to get the actual perspective challenge ID
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

    // Then get the actual perspective challenge using the prompt_id from metrics
    const { data: perspectiveData, error: perspectiveError } = await supabase
      .from("perspective_challenge_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (perspectiveError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve perspective challenge",
          message: perspectiveError.message,
        },
        { status: 404 }
      );
    }

    if (!perspectiveData) {
      return NextResponse.json(
        { error: "Perspective challenge not found" },
        { status: 404 }
      );
    }

    let analysis;
    try {
      // Check if the analysis is empty or null
      if (!perspectiveData.analysis || perspectiveData.analysis === '') {
        return NextResponse.json({
          analysis: null,
          input_data: {
            input: perspectiveData.input,
          },
          metadata: {
            id: perspectiveData.id,
            created_at: perspectiveData.created_at,
            last_edited: perspectiveData.updated_at,
            moderator_approval: metricsData.moderator_approval
          }
        });
      }

      analysis = JSON.parse(perspectiveData.analysis);
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid analysis data format",
          message: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 500 }
      );
    }

    const response = {
      analysis: analysis,
      input_data: {
        input: perspectiveData.input,
      },
      metadata: {
        id: perspectiveData.id,
        created_at: perspectiveData.created_at,
        last_edited: perspectiveData.updated_at,
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
