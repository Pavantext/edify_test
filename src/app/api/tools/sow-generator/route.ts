import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import openai from "@/lib/openai";
import { createClient } from "@/utils/supabase/server";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { calculateGBPPrice } from "@/lib/exchange-service";

export const maxDuration = 299; // Changed to 299 secs maximum

const schemaDescription = {
  data: {
    subject: "string",
    topic: "string",
    ageGroup: {
      year: "number",
    },
    overarchingObjectives: "string[]",
    lessons: [
      {
        lessonNumber: "number",
        title: "string",
        duration: "number",
        learningObjectives: "string[]",
        activities: [
          {
            title: "string",
            description: "string",
            duration: "number",
            resources: "string[]",
          },
        ],
        assessment: "string[]",
        differentiation: {
          support: "string[]",
          core: "string[]",
          extension: "string[]",
        },
        stretchTasks: "string[]",
        scaffoldingStrategies: "string[]",
        reflectionPrompts: "string[]",
        crossCurricularLinks: "string[]",
      },
    ],
    metadata: {
      author: "string",
      createdAt: "string (ISO date)",
      version: "string",
    },
  },
};

export async function POST(req: Request) {
  try {
    // Get the authenticated user's ID
    const { userId } = await auth();
    const supabase = await createClient();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("Received request body:", body);

    if (!body.subject || !body.topic || !body.ageGroup) {
      return NextResponse.json(
        { error: "Missing required fields: subject, topic, and age group" },
        { status: 400 }
      );
    }

    // Get approved ID from URL if present
    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approvedId");

    const systemMessage = `Use UK english only and do not use convoluted language. You are a curriculum planning expert who creates detailed schemes of work. You must respond with a valid JSON object that exactly matches the specified schema structure. Do not include any additional text or explanations outside the JSON object.`;

    const userMessage = `Create a scheme of work with the following details:
    
    Subject: ${body.subject}
    Topic: ${body.topic}
    Year Group: ${body.ageGroup.year}
    Total Lessons: ${body.totalLessons || 6}
    Lesson Duration: ${body.lessonDuration || 60} minutes
    
    Emphasis Areas: ${body.userPreferences?.emphasisAreas?.join(", ") || "Not specified"
      }
    Difficulty Level: ${body.userPreferences?.difficultyLevel || "intermediate"
      }`;

    // Perform content checks only if we don't have an approved ID
    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      // Only perform content checks if we don't have an approved ID
      const result = await performContentChecks(userMessage);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    } else {
      console.log("Skipping content checks due to approved ID");
    }

    if (!shouldProceed) {
      const { data: dbRecord, error: dbError } = await supabase
        .from("sow_generator_results")
        .insert({
          user_id: userId,
          subject: body.subject,
          topic: body.topic,
          year_group: body.ageGroup.year,
          total_lessons: body.totalLessons || 6,
          lesson_duration: body.lessonDuration || 60,
          emphasis_areas: body.userPreferences?.emphasisAreas || [],
          difficulty_level:
            body.userPreferences?.difficultyLevel || "intermediate",
          sow_data: "",
        })
        .select()
        .single();
      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: userMessage.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "sow_generator",
        prompt_id: dbRecord.id,
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            systemMessage +
            `You are a curriculum planning expert. Generate a response that strictly follows this JSON schema structure: ${JSON.stringify(
              schemaDescription,
              null,
              2
            )}`,
        },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseContent = JSON.parse(
      completion.choices[0]?.message?.content || "{}"
    );

    // Store in Supabase
    const { data: dbRecord, error: dbError } = await supabase
      .from("sow_generator_results")
      .insert({
        user_id: userId,
        subject: body.subject,
        topic: body.topic,
        year_group: body.ageGroup.year,
        total_lessons: body.totalLessons || 6,
        lesson_duration: body.lessonDuration || 60,
        emphasis_areas: body.userPreferences?.emphasisAreas || [],
        difficulty_level:
          body.userPreferences?.difficultyLevel || "intermediate",
        sow_data: responseContent,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to store scheme of work" },
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
      input_length: userMessage.length,
      response_length: completion.choices[0].message.content?.length || 0,
      startTime: new Date(),
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "sow_generator",
      prompt_id: dbRecord.id,
      flagged: false,
      status_code: 200,
    });

    return NextResponse.json(dbRecord);
  } catch (error) {
    console.error("Error generating SOW:", error);
    let errorMessage = "Failed to generate scheme of work";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// Add GET endpoint to retrieve approved SOW content
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approved") || searchParams.get("id");

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
      .from("sow_generator_results")
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

    // Prepare input data for pre-filling the form
    const inputData = {
      subject: contentData.subject,
      topic: contentData.topic,
      ageGroup: {
        year: contentData.year_group
      },
      totalLessons: contentData.total_lessons,
      lessonDuration: contentData.lesson_duration,
      userPreferences: {
        emphasisAreas: contentData.emphasis_areas,
        difficultyLevel: contentData.difficulty_level
      }
    };

    return NextResponse.json({
      id: contentData.id,
      sow_data: contentData.sow_data,
      input_data: inputData,
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
