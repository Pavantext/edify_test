import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import {
  PromptGeneratorResponseSchema,
  PromptGeneratorInputSchema,
} from "@/schemas/prompt-schema";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { calculateGBPPrice } from "@/lib/exchange-service";

export const maxDuration = 299;

const SYSTEM_PROMPT = `You are a critical thinking prompt generator for educators. 
Generate exactly 5 refined versions of the input prompt that encourage deeper thinking.
Consider the provided grade level, subject, and skill level in your response.
Your response must match this exact JSON structure for each prompt: refinedPrompts:{
- promptText: The actual prompt text
- explanation: {
    explanation: Detailed explanation of the prompt's purpose
    complexityLevel: {
      refinedLevel: One of ["Foundational", "Intermediate", "Advanced", "Expert", "Master"],
      bloomsLevel: One of ["Remember", "Understand", "Apply", "Analyse", "Evaluate", "Create"]
    }
    focusAreas: Array of specific learning focus areas
}}`;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log("Request body:", body);
    const supabase = await createClient();

    // Get approved ID from URL if present
    const { searchParams } = new URL(request.url);
    const approvedId = searchParams.get("approvedId");

    // Validate input
    let input;
    try {
      input = PromptGeneratorInputSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: "Invalid input format",
            details: validationError.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      throw validationError;
    }

    const startTime = Date.now();

    // Skip content checks if we have an approved ID
    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      // Only perform content checks if we don't have an approved ID
      const result = await performContentChecks(input.originalPrompt);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed) {
      const { data: promptData, error: dbError } = await supabase
        .from("prompt_generator_results")
        .insert({
          user_id: userId,
          input_original_prompt: input.originalPrompt,
          ai_refined_prompts: "",
          processing_time_ms: Date.now() - startTime,
          generation_model: "gpt-4o",
          // status: "violation"
        })
        .select()
        .single();

      // if (dbError || !promptData) {
      //   return NextResponse.json(
      //     { error: "Failed to record violation data" },
      //     { status: 500 }
      //   );
      // }

      // Record the violations in the metrics table
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: input.originalPrompt.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "prompt_generator",
        prompt_id: promptData.id,
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

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Use UK english only and do not use convoluted language." +
              SYSTEM_PROMPT,
          },
          { role: "user", content: JSON.stringify(input) },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      if (!completion.choices[0].message.content) {
        throw new Error("Empty response from OpenAI");
      }

      const response = {
        data: {
          originalPrompt: input.originalPrompt,
          refinedPrompts: JSON.parse(completion.choices[0].message.content)
            .refinedPrompts,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            version: "1.0",
            model: completion.model,
          },
        },
      };

      const validatedResponse = response;

      if (!validatedResponse) {
        throw new Error("Failed to validate generated response");
      }

      const { data, error: dbError } = await supabase
        .from("prompt_generator_results")
        .insert({
          user_id: userId,
          input_original_prompt: input.originalPrompt,
          ai_refined_prompts: validatedResponse.data.refinedPrompts,
          processing_time_ms: validatedResponse.data.metadata.processingTimeMs,
          generation_model: validatedResponse.data.metadata.model,
        })
        .select();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("Failed to save results to database");
      }

      const price = await calculateGBPPrice(
        completion.usage?.prompt_tokens || 0,
        completion.usage?.prompt_tokens || 0,
        "gpt-4o"
      );

      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: input.originalPrompt.length,
        response_length: completion.choices[0].message.content?.length || 0,
        startTime: new Date(),
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        price_gbp: price,
        contentFlags: violations as any,
        prompt_type: "prompt_generator",
        prompt_id: data[0].id,
        flagged: false, // Added missing required flagged property
        status_code: 200,
      });

      return NextResponse.json(
        { data: data[0] },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, must-revalidate",
            "Content-Type": "application/json",
          },
        }
      );
    } catch (openAiError) {
      console.error("OpenAI or Processing Error:", openAiError);
      return NextResponse.json(
        {
          error: "Failed to generate prompts",
          details:
            openAiError instanceof Error
              ? openAiError.message
              : "Unknown error occurred",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unhandled Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 422 }
      );
    }

    // Generic error response for unhandled errors
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
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

    console.log("GET request for approved ID:", approvedId);

    if (!approvedId) {
      return NextResponse.json(
        { error: "Invalid approved ID" },
        { status: 400 }
      );
    }

    // First get the metrics record to get the actual prompt generator ID
    const { data: metricsData, error: metricsError } = await supabase
      .from("ai_tools_metrics")
      .select("*")
      .eq("id", approvedId)
      .single();

    console.log("Metrics data:", metricsData);
    console.log("Metrics error:", metricsError);

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
      console.log("Content not approved:", metricsData.moderator_approval);
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

    // Then get the actual prompt generator data using the prompt_id from metrics
    const { data: promptData, error: promptError } = await supabase
      .from("prompt_generator_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    console.log("Prompt data:", promptData);
    console.log("Prompt error:", promptError);

    if (promptError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve prompt data",
          message: promptError.message,
        },
        { status: 404 }
      );
    }

    if (!promptData) {
      return NextResponse.json(
        { error: "Prompt data not found" },
        { status: 404 }
      );
    }

    let refinedPrompts;
    try {
      console.log("AI refined prompts type:", typeof promptData.ai_refined_prompts);
      console.log("AI refined prompts preview:",
        typeof promptData.ai_refined_prompts === 'string'
          ? promptData.ai_refined_prompts.substring(0, 100) + '...'
          : JSON.stringify(promptData.ai_refined_prompts).substring(0, 100) + '...'
      );

      // Check if the refined prompts are empty or null
      if (!promptData.ai_refined_prompts || promptData.ai_refined_prompts === '') {
        console.log("No refined prompts found, returning null");
        return NextResponse.json({
          refinedPrompts: [],  // Return empty array instead of null
          input_data: {
            originalPrompt: promptData.input_original_prompt,
            focusAreas: promptData.focus_areas,
            grade: promptData.grade,
            subject: promptData.subject,
            skillLevel: promptData.skill_level
          },
          metadata: {
            id: promptData.id,
            created_at: promptData.created_at,
            moderator_approval: metricsData.moderator_approval
          }
        });
      }

      // If it's a string (JSON), parse it
      if (typeof promptData.ai_refined_prompts === 'string') {
        console.log("Parsing string data");
        try {
          refinedPrompts = JSON.parse(promptData.ai_refined_prompts);
        } catch (e) {
          console.error("Error parsing refined prompts:", e);
          // If we can't parse it, return an empty array
          refinedPrompts = [];
        }
      } else {
        // Otherwise use it as is (it's already an object)
        console.log("Using object data directly");
        refinedPrompts = promptData.ai_refined_prompts;
      }

      // Ensure we have an array even if the source data structure is unexpected
      if (!refinedPrompts) {
        console.log("Refined prompts is null or undefined, using empty array");
        refinedPrompts = [];
      } else if (!Array.isArray(refinedPrompts)) {
        console.log("Refined prompts is not an array:", typeof refinedPrompts);
        // If it's not an array but has properties, wrap it
        if (typeof refinedPrompts === 'object' && refinedPrompts !== null) {
          refinedPrompts = [refinedPrompts];
        } else {
          // If it's something else, use an empty array
          refinedPrompts = [];
        }
      }
    } catch (parseError) {
      console.error("Error in parse block:", parseError);
      return NextResponse.json(
        {
          error: "Invalid prompt data format",
          message: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 500 }
      );
    }

    const response = {
      refinedPrompts: refinedPrompts,
      input_data: {
        originalPrompt: promptData.input_original_prompt,
        focusAreas: promptData.focus_areas,
        grade: promptData.grade,
        subject: promptData.subject,
        skillLevel: promptData.skill_level
      },
      metadata: {
        id: promptData.id,
        created_at: promptData.created_at,
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
