import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import openai from "@/lib/openai";
import { auth } from "@clerk/nextjs/server";
import mammoth from "mammoth";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { calculateGBPPrice } from "@/lib/exchange-service";

export const maxDuration = 299; // Changed to 299 secs maximum

async function extractTextFromPDF(file: Blob): Promise<string> {
  const loader = new WebPDFLoader(file);
  const docs = await loader.load();
  return docs.map((doc) => doc.pageContent).join("\n");
}

async function extractTextFromDOC(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function fetchFileAsBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  return await response.blob();
}

async function extractTextFromFile(
  file: Blob,
  fileType: string
): Promise<string> {
  if (fileType === "application/pdf") {
    return await extractTextFromPDF(file);
  } else if (
    fileType === "application/msword" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return await extractTextFromDOC(file);
  }
  throw new Error("Unsupported file type");
}

// Types for the evaluation response
interface EvaluationCriteria {
  rating: "🟢" | "🟡" | "🔴";
  areasOfStrength: string[];
  ideasForDevelopment: string[];
}

interface LessonEvaluation {
  highExpectationsAndPriorKnowledge: EvaluationCriteria;
  pupilProgressAndInclusion: EvaluationCriteria;
  assessmentAndFeedback: EvaluationCriteria;
  adaptiveTeachingAndCognitiveScience: EvaluationCriteria;
  metacognitionAndProfessionalReflection: EvaluationCriteria;
  lessonStructureAndBehaviourManagement: EvaluationCriteria;
  criticalThinkingAndCommunication: EvaluationCriteria;
  finalEvaluation: {
    overallRating: "🟢" | "🟡" | "🔴";
    summary: string;
    keyStrengths: string[];
    developmentAreas: string[];
  };
}

// Validation schema for request body
const requestSchema = z.object({
  fileUrl: z.string().url(),
  name: z.string(),
});

// Function to generate system prompt
function generateSystemPrompt(): string {
  return `You are an expert education consultant specializing in lesson plan evaluation according to UK Teachers' Standards. 
  Use UK English only and avoid convoluted language.
  Analyse lesson plans and provide detailed evaluations in a specific JSON format.
  
  Your evaluation should cover these key areas:
  1. High Expectations & Prior Knowledge
  2. Pupil Progress & Inclusion
  3. Assessment & Feedback
  4. Adaptive Teaching & Cognitive Science
  5. Metacognition & Professional Reflection
  6. Lesson Structure & Behaviour Management
  7. Critical Thinking & Communication
  
  For each area, provide:
  - A rating (🟢, 🟡, or 🔴)
  - Specific areas of strength (2-3 points)
  - Specific ideas for development (2-3 points)
  
  Conclude with an overall evaluation including:
  - Overall rating
  - Brief summary
  - Key strengths (3 points)
  - Development areas (3 points)
  
  Return your evaluation in valid JSON format matching the provided structure.`;
}

// Function to generate user prompt
function generateUserPrompt(lessonPlan: string): string {
  return `Please evaluate this lesson plan and provide your response in valid JSON format:

${lessonPlan}

Response format should be:
{
  "highExpectationsAndPriorKnowledge": {
    "rating": "🟢 | 🟡 | 🔴",
    "areasOfStrength": ["point1", "point2", "point3"],
    "ideasForDevelopment": ["point1", "point2", "point3"]
  },
  "finalEvaluation": {
    "overallRating": "🟢 | 🟡 | 🔴",
    "summary": "brief summary text",
    "keyStrengths": ["point1", "point2", "point3"],
    "developmentAreas": ["point1", "point2", "point3"]
  }
}`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const supabase = await createClient();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Parse and validate request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    const fileBlob = await fetchFileAsBlob(validatedData.fileUrl);
    const fileType = fileBlob.type;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(fileType)) {
      throw new Error(
        "Invalid file type. Only PDF and DOC/DOCX files are supported."
      );
    }

    const fileContent = await extractTextFromFile(fileBlob, fileType);

    const input_lesson_plan = validatedData.name + fileContent;

    // Perform content checks
    const { violations, shouldProceed } = await performContentChecks(
      input_lesson_plan
    );

    if (!shouldProceed) {
      const { data, error: dbError } = await supabase
        .from("lesson_plan_evaluations")
        .insert({
          name: validatedData.name,
          file_url: validatedData.fileUrl,
          evaluation: "",
          user_id: userId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: (generateSystemPrompt() + generateUserPrompt(fileContent))
          .length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "lesson_plan_evaluator",
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

    // Get evaluation from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: generateSystemPrompt() },
        {
          role: "user",
          content: generateUserPrompt(fileContent),
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    console.log(
      completion.usage?.prompt_tokens,
      completion.usage?.completion_tokens,
      completion.usage?.total_tokens
    );

    // Parse the response
    const evaluationResponse = completion.choices[0]?.message?.content;
    if (!evaluationResponse) {
      throw new Error("No evaluation received from OpenAI");
    }

    // Parse JSON response
    const evaluation = JSON.parse(evaluationResponse || "{}") as any;

    const { data, error: dbError } = await supabase
      .from("lesson_plan_evaluations")
      .insert({
        name: validatedData.name,
        file_url: validatedData.fileUrl,
        evaluation: evaluation,
        user_id: userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Failed to store evaluation:", dbError);
    }

    const price = await calculateGBPPrice(
      completion.usage?.prompt_tokens || 0,
      completion.usage?.prompt_tokens || 0,
      "gpt-4o"
    );

    await recordAIToolsMetrics({
      userId: userId!,
      model: "gpt-4o",
      input_length: (generateSystemPrompt() + generateUserPrompt(fileContent))
        .length,
      response_length: completion.choices[0].message.content?.length || 0,
      startTime: new Date(),
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "lesson_plan_evaluations",
      prompt_id: data.id,
      flagged: false, // Added missing required flagged property
      status_code: 200,
    });

    // Return response
    return NextResponse.json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: `Failed to evaluate lesson plan: ${
            (error as Error).message
          }`,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
