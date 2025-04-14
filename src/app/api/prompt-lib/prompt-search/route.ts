import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { auth } from "@clerk/nextjs/server";

interface RefinedPrompt {
  promptText: string;
  ratings?: {
    averageRating?: number;
    totalRatings?: number;
    ratings?: Array<{
      rating: number;
      userId: string;
      timestamp: string;
    }>;
  };
  explanation: {
    focusAreas?: string[];
    explanation?: string;
    complexityLevel?: {
      bloomsLevel?: string;
      refinedLevel?: string;
    };
  };
}

export interface PromptResult {
  id: string;
  input_original_prompt: string;
  ai_refined_prompts: RefinedPrompt[];
  created_at: string;
  processing_time_ms: number;
  generation_model: string;
}

export async function POST(req: Request) {
  try {
    // First get auth then parse body
    const { userId, orgId } = await auth();
    const body = await req.text(); // Get raw body
    
    if (!body) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      );
    }

    const { query } = JSON.parse(body); // Manual parsing
    
    if (!query?.trim()) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: "Authentication required for search" }, 
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Search in both original prompt and refined prompts
    const { data, error } = await supabase
      .from('prompt_generator_results')
      .select('*')
      .or(`input_original_prompt.ilike.%${query}%,ai_refined_prompts->*->>text.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("[PROMPT_SEARCH_ERROR]", error);
      return NextResponse.json(
        { error: "Failed to search prompts" }, 
        { status: 500 }
      );
    }

    // Transform and validate the data
    const results = data?.map(item => ({
      id: item.id,
      originalPrompt: item.input_original_prompt,
      refinedPrompts: item.ai_refined_prompts?.map((p: any) => ({
        promptText: p.promptText,
        ratings: p.ratings ? {
          averageRating: p.ratings.averageRating,
          totalRatings: p.ratings.totalRatings
        } : undefined,
        explanation: {
          explanation: p.explanation?.explanation,
          complexityLevel: {
            refinedLevel: p.explanation?.complexityLevel?.refinedLevel,
            bloomsLevel: p.explanation?.complexityLevel?.bloomsLevel
          },
          focusAreas: p.explanation?.focusAreas
        }
      })) || [],
      createdAt: item.created_at,
      processing_time_ms: item.processing_time_ms,
      generation_model: item.generation_model || 'gpt-3.5-turbo',
      input_original_prompt: item.input_original_prompt
    })) || [];

    return NextResponse.json({ results });

  } catch (error) {
    console.error("[PROMPT_SEARCH_ERROR]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" }, 
      { status: 500 }
    );
  }
}