import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { auth } from "@clerk/nextjs/server";

export interface MCQResult {
  id: string;
  type: 'mcq';
  topic: string;
  difficulty: string;
  total_questions: number;
  taxonomy_levels: string[];
  questions_data: Array<{
    text: string;
    answers: Array<{
      text: string;
      is_correct: boolean;
    }>;
    explanation?: string;
    taxonomy_level?: string;
  }>;
  created_at: string;
  processing_time_ms?: number;
  generation_model?: string;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const supabase = createServiceClient();
    
    // Fetch organization members
    const { data: orgUsers, error: orgUsersError } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId);

    if (orgUsersError) {
        console.error("Error fetching organization users:", orgUsersError);
        return NextResponse.json(
            { error: "Failed to fetch organization users" },
            { status: 500 }
        );
    }

    const userIdsToFetch = orgUsers.map((user: any) => user.user_id);
    
    const { data, error } = await supabase
      .from('mcq_generator_results')
      .select('*')
      .in("user_id", userIdsToFetch)
      .ilike('topic', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    // Transform the data to match expected UI format
    const results = data?.map(item => {
      // Process the questions to standardize the format
      const processedQuestions = (item.questions_data?.questions || []).map((question: any) => {
        // If answers already have the correct structure, use them
        if (Array.isArray(question.answers) && question.answers.length > 0 && 'is_correct' in question.answers[0]) {
          return question;
        }
        
        // Otherwise, transform the answers to match expected format
        return {
          text: question.text,
          answers: (question.answers || []).map((answer: any) => ({
            text: answer.text || answer,
            is_correct: answer.isCorrect === true || answer.text === question.correct_answer
          })),
          explanation: question.explanation,
          taxonomy_level: question.taxonomyLevel || question.taxonomy_level
        };
      });
      
      return {
        id: item.id,
        type: 'mcq',
        topic: item.topic,
        difficulty: item.difficulty,
        total_questions: item.total_questions || (processedQuestions?.length || 0),
        taxonomy_levels: item.taxonomy_levels || [],
        questions_data: item.questions_data,
        createdAt: item.created_at,
        processing_time_ms: item.processing_time_ms,
        generation_model: item.generation_model
      };
    }) || [];
    
    console.log("[MCQ_SEARCH] Processed questions format:", 
      results.length > 0 ? results[0].questions_data[0] : "No results");
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[MCQ_SEARCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to search MCQs" },
      { status: 500 }
    );
  }
}