import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { calculateGBPPrice } from "@/lib/exchange-service";

const BATCH_SIZE = 5;
export const maxDuration = 299; // Changed to 299 secs maximum

async function generateQuestionBatch(
  topic: string,
  batchSize: number,
  difficulty: string,
  questionTypes: string[],
  subject?: string,
  gradeLevel?: string,
  bloomsLevels?: string[]
) {
  // Join multiple Bloom's levels if provided
  const bloomsLevelsText =
    bloomsLevels && bloomsLevels.length > 0
      ? bloomsLevels.join(", ")
      : "understand";

  const schema = `
  {
    "metadata": {
      "title": string,
      "subject": string (optional),
      "gradeLevel": string (optional),
      "difficulty": "easy" | "medium" | "hard",
      "bloomsLevel": string,
      "duration": number (optional),
      "totalPoints": number,
      "createdAt": ISO date string,
      "lastUpdated": ISO date string
    },
    "instructions": string[],
    "questions": [
      {
        "questionText": string,
        "questionType": "multiple_choice" | "true_false" | "short_answer" | "fill_in_blanks",
        "difficulty": "easy" | "medium" | "hard",
        "bloomsLevel": string,
        "points": number,
        "options": [
          {
            "text": string,
            "isCorrect": boolean,
            "explanation": string (optional)
          }
        ],
        "correctAnswer": string,
        "blanks": [
          {
            "word": string,
            "position": number,
            "hint": string (optional)
          }
        ],
        "explanation": string (optional),
        "acceptableAnswers": string[]
      }
    ]
  }`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an educational assessment expert who creates engaging quizzes. Generate quiz content in UK English, avoiding convoluted language.
        For short answer questions, always include a correct answer and acceptable alternative answers.
        For fill in the blanks questions:
        - Create sentences with clear context
        - Choose appropriate words to remove
        - Mark blanks in the text with ___(1)___, ___(2)___, etc.
        - Always provide the correct word for each blank in the 'blanks' array
        - Include an explanation for each answer
        - Optionally provide hints to help students
       
        IMPORTANT: Only generate questions of the types specifically requested by the user.
        Your responses must be valid JSON objects that strictly follow this schema: ${schema}`,
      },
      {
        role: "user",
        content: `Generate a quiz with:
        Topic: ${topic}
        Number of Questions: ${batchSize}
        Difficulty Level: ${difficulty}
        Question Types: ONLY generate questions of these types: ${questionTypes.join(", ")}
        Bloom's Taxonomy Levels: ${bloomsLevelsText}
        ${subject ? `Subject: ${subject}` : ""}
        ${gradeLevel ? `Grade Level: ${gradeLevel}` : ""}
       
        IMPORTANT INSTRUCTIONS:
        1. ONLY generate questions of the types listed above (${questionTypes.join(", ")})
        2. Do not include any other question types
        3. Distribute the questions evenly among the selected types
       
        For fill in the blanks questions:
        - Create clear, educational sentences with numbered blanks
        - Each blank should test understanding of key concepts
        - Provide the correct word for each blank
        - Include helpful hints where appropriate
        - Add explanations for why each answer is correct
        - Format blanks as ___(1)___, ___(2)___, etc.
       
        Distribute questions across the specified Bloom's Taxonomy levels: ${bloomsLevelsText}.`,
      },
    ],
    temperature: 0.7,
  });

  const responseContent = completion.choices[0].message.content;
  const parsedResponse = JSON.parse(responseContent || "{}");

  // Validate that only requested question types are present
  if (parsedResponse.questions) {
    parsedResponse.questions = parsedResponse.questions.filter((q: any) =>
      questionTypes.includes(q.questionType)
    );
  }

  return {
    ...parsedResponse,
    usage: {
      prompt_tokens: completion.usage?.prompt_tokens || 0,
      completion_tokens: completion.usage?.completion_tokens || 0,
      total_tokens: completion.usage?.total_tokens || 0
    }
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get approved ID from URL if present
    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approved");

    // If using approved content, skip content checks
    let shouldSkipContentChecks = false;

    if (approvedId) {
      // Verify this is a valid approved content ID
      const { data: metricsData, error: metricsError } = await supabase
        .from("ai_tools_metrics")
        .select("*")
        .eq("id", approvedId)
        .single();

      if (!metricsError && metricsData && metricsData.moderator_approval === 'approved') {
        shouldSkipContentChecks = true;
      }
    }

    const body = await req.json();
    const {
      topic,
      questionCount,
      difficulty,
      questionTypes,
      subject,
      gradeLevel,
      bloomsLevels, // Now expecting an array
    } = body;

    if (
      !topic ||
      !questionCount ||
      !difficulty ||
      !questionTypes ||
      !bloomsLevels
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Perform content checks if not using approved content
    let violations = {};
    let shouldProceed = true;

    if (!shouldSkipContentChecks) {
      const result = await performContentChecks(topic);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed) {
      const { data: quizData, error: dbError } = await supabase
        .from("quiz_generator_results")
        .insert([
          {
            user_id: userId,
            topic,
            question_count: questionCount,
            difficulty_level: difficulty,
            question_types: questionTypes,
            subject: subject || null,
            grade_level: gradeLevel || null,
            blooms_level: "", // Store as string for compatibility
            quiz_data: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();
      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: topic.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "quiz_generator",
        prompt_id: quizData.id,
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

    // Calculate number of batches needed
    const numberOfBatches = Math.ceil(questionCount / BATCH_SIZE);
    const allQuestions = [];

    // Track token usage across batches
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;

    // Generate questions in batches
    for (let i = 0; i < numberOfBatches; i++) {
      const remainingQuestions = questionCount - i * BATCH_SIZE;
      const currentBatchSize = Math.min(BATCH_SIZE, remainingQuestions);

      const batchResult = await generateQuestionBatch(
        topic,
        currentBatchSize,
        difficulty,
        questionTypes,
        subject,
        gradeLevel,
        bloomsLevels
      );

      allQuestions.push(...(batchResult.questions || []));

      // Accumulate token usage
      if (batchResult.usage) {
        totalPromptTokens += batchResult.usage.prompt_tokens || 0;
        totalCompletionTokens += batchResult.usage.completion_tokens || 0;
        totalTokens += batchResult.usage.total_tokens || 0;
      }
    }

    // Join Bloom's levels for metadata display
    const bloomsLevelsDisplay = bloomsLevels.join(", ");

    // Combine all batches into final quiz object
    const finalQuiz = {
      metadata: {
        title: `Quiz on ${topic}`,
        subject: subject || undefined,
        gradeLevel: gradeLevel || undefined,
        difficulty,
        bloomsLevel: bloomsLevelsDisplay, // Display all selected levels
        totalPoints: allQuestions.reduce((sum, q) => sum + (q.points || 0), 0),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
      instructions: [
        `This quiz contains ${questionCount} questions about ${topic}.`,
        `Questions cover Bloom's taxonomy levels: ${bloomsLevelsDisplay}.`,
        `Please read each question carefully before answering.`,
      ],
      questions: allQuestions,
    };

    // Store in Supabase with separate columns
    const { data: quizData, error: dbError } = await supabase
      .from("quiz_generator_results")
      .insert([
        {
          user_id: userId,
          topic,
          question_count: questionCount,
          difficulty_level: difficulty,
          question_types: questionTypes,
          subject: subject || null,
          grade_level: gradeLevel || null,
          blooms_level: bloomsLevelsDisplay, // Store as string for compatibility
          quiz_data: finalQuiz,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Calculate price in GBP
    const price = await calculateGBPPrice(
      totalPromptTokens,
      totalCompletionTokens,
      "gpt-4o"
    );

    // Record metrics
    await recordAIToolsMetrics({
      userId: userId!,
      model: "gpt-4o",
      input_length: topic.length,
      response_length: JSON.stringify(finalQuiz).length,
      startTime: new Date(),
      inputTokens: totalPromptTokens,
      outputTokens: totalCompletionTokens,
      totalTokens: totalTokens,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "quiz_generator",
      prompt_id: quizData.id,
      flagged: false,
      status_code: 200,
    });

    return NextResponse.json(
      {
        stored_quiz: quizData,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json(
      {
        error: "Failed to generate quiz",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Add GET endpoint for approved content
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

    // First get the metrics record to get the actual quiz generator ID
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

    // Then get the actual quiz using the prompt_id from metrics
    const { data: quizData, error: quizError } = await supabase
      .from("quiz_generator_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (quizError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve quiz data",
          message: quizError.message,
        },
        { status: 404 }
      );
    }

    if (!quizData) {
      return NextResponse.json(
        { error: "Quiz data not found" },
        { status: 404 }
      );
    }

    // Return the quiz data in a structured format
    return NextResponse.json({
      stored_quiz: quizData,
      input_data: {
        topic: quizData.topic,
        questionCount: quizData.question_count,
        difficulty: quizData.difficulty_level,
        questionTypes: quizData.question_types,
        subject: quizData.subject,
        gradeLevel: quizData.grade_level,
        bloomsLevels: quizData.blooms_level ? quizData.blooms_level.split(', ') : []
      },
      metadata: {
        id: quizData.id,
        created_at: quizData.created_at,
        last_edited: quizData.updated_at,
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