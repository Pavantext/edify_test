import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { calculateGBPPrice } from "@/lib/exchange-service";
import { sendEmail } from "@/lib/email-service";

export const maxDuration = 299; // Changed to 299 secs maximum

// Enhanced input validation schema with SEND and differentiation
const inputSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  yearGroup: z.string().optional(),
  duration: z
    .string()
    .transform((val) => parseInt(val))
    .pipe(
      z
        .number()
        .min(1, "Duration must be at least 1 minute")
        .max(60, "Duration cannot exceed 60 minutes")
    ),
  subject: z.string().optional(),
  learningObjectives: z.string().default(""), // Make it optional with a default empty string
  specialConsiderations: z
    .object({
      differentiation: z
        .object({
          higherAbility: z.boolean().optional(),
          lowerAbility: z.boolean().optional(),
          esl: z.boolean().optional(),
        })
        .optional(),
      send: z
        .object({
          visualImpairment: z.boolean().optional(),
          hearingImpairment: z.boolean().optional(),
          dyslexia: z.boolean().optional(),
          autism: z.boolean().optional(),
          adhd: z.boolean().optional(),
        })
        .optional(),
      culturalConsiderations: z.string().optional(),
    })
    .optional(),
});

const schemaDescription = `
The response must conform to the following detailed structure:
{
  overview: {
    subject: string (required),
    topic: string (required),
    yearGroup: string (required),
    duration: number (required, must not exceed 60 minutes),
    learningObjectives: string[] (required, 3-4 clear objectives),
    initialPrompts: string[] (required, 3-4 thought-provoking questions to engage students)
  },
  lessonOptions: [
    {
      optionNumber: number (required, must include options 1, 2, and 3),
      starterActivity: {
        description: string (required),
        duration: number (required, typically 5-10 minutes),
        materials: string[] (required),
        instructions: string[] (required, step-by-step)
      },
      mainActivities: [{
        description: string (required),
        duration: number (required),
        materials: string[] (required),
        instructions: string[] (required, step-by-step),
        differentiation: {
          support: string[] (optional, strategies for lower ability),
          core: string[] (optional, main activities),
          extension: string[] (optional, challenges for higher ability)
        }
      }],
      plenary: {
        description: string (required),
        duration: number (required, typically 5-10 minutes),
        instructions: string[] (required),
        successIndicators: string[] (required, how to assess learning)
      }
    }
  ] (exactly 3 options required),
  reflectionSuggestions: string[] (required, 3-4 strategies for students to evaluate learning),
  differentiationAndSEN: {
    differentiation: {
      support: string[] (optional, general strategies for lower ability),
      core: string[] (optional, main strategies),
      extension: string[] (optional, strategies for higher ability)
    },
    senSupport: {
      visual: string[] (optional, support for visual impairments),
      auditory: string[] (optional, support for hearing impairments),
      cognitive: string[] (optional, support for learning difficulties)
    }
  },
  crossCurricularLinks: string[] (required, at least 3 links to other subjects),
  assessmentQuestions: {
    knowledge: string[] (required, remembering facts),
    comprehension: string[] (required, understanding concepts),
    application: string[] (required, applying knowledge),
    analysis: string[] (required, analyzing information),
    synthesis: string[] (required, creating new ideas),
    evaluation: string[] (required, making judgments)
  },
  additionalNotes: string[] (required, pedagogical tips and advice)
}`;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();

    const body = await req.json();
    const validatedInput = inputSchema.parse(body);

    // Get approved ID from URL if present
    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approvedId");

    // Check if this is a history subject
    const isHistoricalTopic =
      validatedInput.subject?.toLowerCase() === "history";

    // Enhanced prompt with more specific requirements
    const prompt = `Create an educational lesson plan focusing on academic understanding and critical analysis:
    Topic: ${validatedInput.topic}
    ${validatedInput.yearGroup ? `Year Group: ${validatedInput.yearGroup}` : ""}
    Duration: ${validatedInput.duration} minutes (STRICT REQUIREMENT)
    ${validatedInput.subject ? `Subject: ${validatedInput.subject}` : ""}
    
    Please create an academically rigorous lesson plan that:
    1. Develops analytical and critical thinking skills
    2. Uses evidence-based teaching methods that:
       - Promote academic understanding
       - Incorporate varied learning resources
       - Support analytical skill development
    3. Structure each teaching approach (total: ${validatedInput.duration
      } minutes) as:
       - Opening activity (5-10 minutes)
       - Main learning activities (remaining time)
       - Concluding assessment (5-10 minutes)
    4. Use academic sources and materials
    5. Include varied teaching resources

    Key Requirements:
    1. Provide THREE distinct teaching approaches:
       - Approach 1: Research and analysis based learning
       - Approach 2: Structured academic exploration
       - Approach 3: Collaborative academic investigation
    2. For each approach:
       - Use academic terminology
       - Include varied learning materials
       - Support evidence-based learning
       - Maintain exact timing (${validatedInput.duration} minutes)
    3. Include assessment criteria that:
       - Measure academic understanding
       - Support analytical thinking
       - Evaluate learning outcomes

    Additional Guidelines:
    - Use academic language throughout
    - Include varied source materials
    - Support analytical discussion
    - Focus on evidence-based learning
    ${validatedInput.specialConsiderations?.differentiation
        ? "- Support diverse learning needs"
        : ""
      }
    ${validatedInput.specialConsiderations?.send
        ? "- Ensure accessible learning materials"
        : ""
      }

    TIMING REQUIREMENT: Each approach must total EXACTLY ${validatedInput.duration
      } minutes.`;

    // Skip content checks if we have an approved ID
    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      // Only perform content checks if we don't have an approved ID
      const result = await performContentChecks(prompt);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed) {
      const { data: violatedData, error: violatedError } = await supabase
        .from("lesson_plan_results")
        .insert({
          user_id: userId,
          input_topic: validatedInput.topic,
          input_year_group: validatedInput.yearGroup,
          input_duration: validatedInput.duration,
          input_subject: validatedInput.subject,
          input_special_considerations: JSON.stringify(
            validatedInput.specialConsiderations
          ),
          ai_lesson_plan: "",
        })
        .select()
        .single();

      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: prompt.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "lesson_plan",
        prompt_id: violatedData.id,
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

    // Enhanced OpenAI API call with function calling to enforce duration
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an experienced educator creating detailed, evidence-based lesson plans in JSON format. 
          Use UK English only and avoid convoluted language.
          Your primary requirements are:
          1. Create practical, achievable activities with clear instructions
          2. STRICTLY ensure the sum of all activity durations equals EXACTLY the requested total duration
          3. Break down the time as follows:
             - Starter: 5-10 minutes
             - Main activities: Remaining time (total - starter - plenary)
             - Plenary: 5-10 minutes
          4. Double-check all durations sum to the exact total before responding
          ${schemaDescription}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const lessonPlan = JSON.parse(
      completion.choices[0].message.content || "{}"
    );

    // Enhanced duration validation
    const validateDuration = (plan: any) => {
      let totalDuration = 0;
      const durations: { activity: string; duration: number }[] = [];

      plan.lessonOptions.forEach((option: any) => {
        // Add starter duration
        totalDuration += option.starterActivity.duration;
        durations.push({
          activity: "Starter",
          duration: option.starterActivity.duration,
        });

        // Add main activities durations
        option.mainActivities.forEach((activity: any, index: number) => {
          totalDuration += activity.duration;
          durations.push({
            activity: `Main Activity ${index + 1}`,
            duration: activity.duration,
          });
        });

        // Add plenary duration
        totalDuration += option.plenary.duration;
        durations.push({
          activity: "Plenary",
          duration: option.plenary.duration,
        });
      });

      // if (totalDuration !== validatedInput.duration) {
      //   console.error('Duration mismatch:', {
      //     expected: validatedInput.duration,
      //     actual: totalDuration,
      //     breakdown: durations
      //   });
      //   return false;
      // }

      return true;
    };

    if (!validateDuration(lessonPlan)) {
      return NextResponse.json(
        {
          error:
            "Generated lesson plan duration does not match requested duration",
          message:
            "Please try again. The lesson plan activities must total exactly the requested duration.",
        },
        { status: 400 }
      );
    }

    // Save to database
    const { data, error } = await supabase
      .from("lesson_plan_results")
      .insert({
        user_id: userId,
        input_topic: validatedInput.topic,
        input_year_group: validatedInput.yearGroup,
        input_duration: validatedInput.duration,
        input_subject: validatedInput.subject,
        input_special_considerations: JSON.stringify(
          validatedInput.specialConsiderations
        ),
        ai_lesson_plan: JSON.stringify(lessonPlan),
      })
      .select();

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to save lesson plan" },
        { status: 500 }
      );
    }
    const price = await calculateGBPPrice(
      completion.usage?.prompt_tokens || 0,
      completion.usage?.prompt_tokens || 0,
      "gpt-4o"
    );

    await recordAIToolsMetrics({
      userId: userId!,
      model: "gpt-4o",
      input_length: prompt.length,
      response_length: completion.choices[0].message.content?.length || 0,
      startTime: new Date(),
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "lesson_plan",
      prompt_id: data[0].id,
      flagged: false,
      status_code: 200,
    });

    return NextResponse.json({ data: data[0] }, { status: 200 });
  } catch (error) {
    console.error("Error in lesson plan generation:", error);
    return NextResponse.json(
      { error: "Failed to generate lesson plan" },
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

    // First get the metrics record to get the actual lesson plan ID
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

    // Then get the actual lesson plan using the prompt_id from metrics
    const { data: lessonPlanData, error: lessonPlanError } = await supabase
      .from("lesson_plan_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (lessonPlanError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve lesson plan",
          message: lessonPlanError.message,
        },
        { status: 404 }
      );
    }

    if (!lessonPlanData) {
      return NextResponse.json(
        { error: "Lesson plan not found" },
        { status: 404 }
      );
    }

    let lessonPlan;
    try {
      // Check if the lesson plan is empty or null
      if (!lessonPlanData.ai_lesson_plan || lessonPlanData.ai_lesson_plan === '') {
        return NextResponse.json({
          lesson_plan: null,
          input_data: {
            topic: lessonPlanData.input_topic,
            yearGroup: lessonPlanData.input_year_group,
            duration: lessonPlanData.input_duration,
            subject: lessonPlanData.input_subject,
            specialConsiderations: lessonPlanData.input_special_considerations ?
              JSON.parse(lessonPlanData.input_special_considerations) :
              undefined
          },
          metadata: {
            id: lessonPlanData.id,
            created_at: lessonPlanData.created_at,
            last_edited: lessonPlanData.updated_at,
            moderator_approval: metricsData.moderator_approval
          }
        });
      }

      lessonPlan = JSON.parse(lessonPlanData.ai_lesson_plan);
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid lesson plan data format",
          message: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 500 }
      );
    }

    const response = {
      lesson_plan: lessonPlan,
      input_data: {
        topic: lessonPlanData.input_topic,
        yearGroup: lessonPlanData.input_year_group,
        duration: lessonPlanData.input_duration,
        subject: lessonPlanData.input_subject,
        specialConsiderations: lessonPlanData.input_special_considerations ?
          JSON.parse(lessonPlanData.input_special_considerations) :
          undefined
      },
      metadata: {
        id: lessonPlanData.id,
        created_at: lessonPlanData.created_at,
        last_edited: lessonPlanData.updated_at,
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

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lessonPlanId = searchParams.get("id");

    if (!lessonPlanId) {
      return NextResponse.json(
        { error: "Invalid lesson plan ID" },
        { status: 400 }
      );
    }

    const updatedLessonPlan = await req.json();

    const { data, error } = await supabase
      .from("lesson_plan_results")
      .update({
        ai_lesson_plan: JSON.stringify(updatedLessonPlan),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lessonPlanId)
      .select();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to update lesson plan",
          message: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      lesson_plan: data[0],
      message: "Lesson plan updated successfully",
    });
  } catch (error) {
    console.error("Error updating lesson plan:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
