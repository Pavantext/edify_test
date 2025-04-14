import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

interface AILessonPlan {
  overview: {
    subject: string;
    topic: string;
    yearGroup: string;
    duration: number;
    learningObjectives: {
      main: string[];
      successCriteria: Array<{
        objective: string;
        assessment: {
          method: string;
          evidence: string;
          differentiation: {
            support: string[];
            extension: string[];
          };
        };
      }>;
    };
    lessonStructure: {
      starter: {
        description: string;
        duration: number;
        materials: string[];
        teacherInstructions: string[];
        studentInstructions: string[];
        expectedOutcomes: string[];
      };
      mainActivities: Array<{
        title: string;
        description: string;
        duration: number;
        materials: string[];
        teacherInstructions: string[];
        studentInstructions: string[];
        experimentDetails: Record<string, unknown>;
        worksheetContent: {
          questions: string[];
          tasks: string[];
          resources: string[];
        };
        differentiation: {
          support: string[];
          core: string[];
          extension: string[];
        };
      }>;
      plenary: {
        description: string;
        duration: number;
        assessmentMethod: string;
        successIndicators: string[];
      };
    };
    sendSupport: {
      visualSupport: string[];
      auditorySupport: string[];
      dyslexiaSupport: string[];
      autismSupport: string[];
      adhdSupport: string[];
    };
    assessmentStrategies: {
      formative: Array<{
        method: string;
        timing: string;
        successIndicators: string[];
        followUp: string[];
      }>;
      summative: {
        method: string;
        criteria: string[];
        differentiation: {
          support: string[];
          extension: string[];
        };
      };
    };
  };
}

interface LessonPlanResult {
  id: string;
  type: 'lesson';
  input_topic: string;
  input_year_group?: string;
  input_duration?: number;
  input_subject?: string;
  input_special_considerations?: {
    differentiation?: {
      higherAbility: boolean;
      lowerAbility: boolean;
      esl: boolean;
    };
    send?: {
      visualImpairment: boolean;
      hearingImpairment: boolean;
      dyslexia: boolean;
      autism: boolean;
      adhd: boolean;
    };
  };
  ai_lesson_plan: AILessonPlan;
  created_at: string;
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { query } = await req.json();

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
      .from('lesson_plan_results')
      .select(`
        id,
        input_topic,
        input_year_group,
        input_duration,
        input_subject,
        input_special_considerations,
        ai_lesson_plan,
        created_at
      `)
      .in("user_id", userIdsToFetch)
      .or(`input_topic.ilike.%${query}%,ai_lesson_plan->overview->>topic.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const results = data?.map((item) => {
      const aiLessonPlan = typeof item.ai_lesson_plan === 'string' ?
        JSON.parse(item.ai_lesson_plan) :
        item.ai_lesson_plan;

      if (!aiLessonPlan?.overview){
        console.warn("aiLessonPlan overview was undefined");
        return {...item, type: 'lesson' as const, ai_lesson_plan: {}, input_special_considerations: item.input_special_considerations || {}, createdAt: item.created_at};
      }

      return {
        ...item,
        type: 'lesson' as const,
        ai_lesson_plan: {
          overview: {
            ...aiLessonPlan.overview,
            lessonStructure: {
              ...aiLessonPlan.overview.lessonStructure,
              mainActivities: (aiLessonPlan.overview.lessonStructure && aiLessonPlan.overview.lessonStructure.mainActivities || []).map((activity: any) => ({
                ...activity,
                experimentDetails: activity.experimentDetails || {},
              })),
            },
          },
        },
        input_special_considerations: item.input_special_considerations || {},
        createdAt: item.created_at
      };
    }) as LessonPlanResult[] || [];

    console.log('Lesson Plan Results:', results);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[LESSON_PLAN_SEARCH] Error:', error);
    return NextResponse.json(
      { 
        error: "Failed to search lesson plans", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
