import { NextResponse } from "next/server";
import { MCQGeneratorSchema } from "@/schemas/mcq-schema";
import openai from "@/lib/openai";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import mammoth from "mammoth";
import { calculateGBPPrice } from "@/lib/exchange-service";

export const maxDuration = 299;

const BATCH_SIZE = 5;

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

// Helper function to generate questions in batches
async function generateQuestionBatch(
  batchSize: number,
  topic: string,
  taxonomyLevels: string[],
  difficulty: string,
  answersPerQuestion: number
) {
  // Calculate questions per level ensuring even distribution
  const questionsPerLevel = Math.ceil(batchSize / taxonomyLevels.length);
  const totalQuestions = questionsPerLevel * taxonomyLevels.length;

  try {
    const systemMessage = `You are an educational assessment expert who creates high-quality multiple choice questions. 
Use UK English only and avoid convoluted language.
Generate exactly ${batchSize} questions, evenly distributed across all specified taxonomy levels (${taxonomyLevels.join(
      ", "
    )}). 
Each question should:
- Strictly match the specified difficulty level (${difficulty})
- Include a detailed explanation for why the correct answer is correct
- Have explanations that are pedagogically sound and help learners understand the concept
You must respond with a valid JSON object that exactly matches the specified schema structure.`;

    const userMessage = `Create ${batchSize} multiple choice questions for:
     Topic: ${topic}
     Number of Options per Question: ${answersPerQuestion || 4}
     Difficulty Level: ${difficulty}
     Questions per Taxonomy Level: ${questionsPerLevel}
     Bloom's Taxonomy Levels: ${taxonomyLevels.join(", ")}
     
     Requirements:
     - Generate equal number of questions for EACH taxonomy level
     - Include detailed explanations for correct answers
     - Ensure questions are appropriate for the taxonomy level
     - Make sure each question tests the specific cognitive skill of its taxonomy level

     Return ONLY a JSON object with this exact structure:
     {
       "data": {
         "questions": [
           {
             "text": "string",
             "taxonomyLevel": "string",
             "answers": [
               {
                 "text": "string",
                 "isCorrect": boolean,
                 "explanation": "string (detailed explanation for why this answer is correct/incorrect)"
               }
             ],
             "explanation": "string (comprehensive explanation of the correct answer)"
           }
         ],
         "metadata": {
           "topic": "string",
           "difficulty": "string",
           "totalQuestions": number,
           "taxonomyLevels": ["string"],
           "timestamp": "string"
         }
       }
     }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        { role: "user", content: userMessage },
      ],
    });

    const responseContent = completion.choices[0].message.content;

    if (!responseContent) {
      console.error("Empty response from OpenAI");
      return createEmptyBatchResponse();
    }

    try {
      const parsedResponse = JSON.parse(responseContent);

      // Validate response structure
      if (!parsedResponse.data || !Array.isArray(parsedResponse.data.questions)) {
        console.error("Invalid response structure from OpenAI", parsedResponse);
        return createEmptyBatchResponse();
      }

      return parsedResponse.data;
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      return createEmptyBatchResponse();
    }
  } catch (err) {
    console.error("Error generating question batch:", err);
    return createEmptyBatchResponse();
  }
}

// Helper function to create a valid empty response
function createEmptyBatchResponse() {
  return {
    questions: [],
    metadata: {
      topic: "Failed to generate",
      difficulty: "medium",
      totalQuestions: 0,
      taxonomyLevels: [],
      timestamp: new Date().toISOString(),
    }
  };
}

// Helper function to check if two questions are similar
function areQuestionsSimilar(q1: any, q2: any) {
  // Convert to lowercase and remove punctuation for comparison
  const normalize = (text: string) =>
    text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

  const q1Text = normalize(q1.text);
  const q2Text = normalize(q2.text);

  // Check if questions are too similar (80% similarity threshold)
  const similarity = (a: string, b: string) => {
    if (a.length > b.length) [a, b] = [b, a];
    return a.length > 0 ? (b.includes(a) ? a.length / b.length : 0) : 0;
  };

  return similarity(q1Text, q2Text) > 0.8;
}

// Helper function to merge and deduplicate questions
function mergeAndDeduplicateQuestions(batches: any[]) {
  const uniqueQuestions: any[] = [];

  batches.forEach((batch) => {
    // Check if batch and batch.questions exists before trying to iterate
    if (batch && Array.isArray(batch.questions)) {
      batch.questions.forEach((question: any) => {
        if (question && question.text) {
          const isDuplicate = uniqueQuestions.some((q) =>
            areQuestionsSimilar(q, question)
          );
          if (!isDuplicate) {
            uniqueQuestions.push(question);
          }
        }
      });
    }
  });

  return uniqueQuestions;
}

// Helper function to validate question distribution
function validateQuestionDistribution(
  questions: any[],
  taxonomyLevels: string[]
) {
  const distribution = new Map<string, number>();
  taxonomyLevels.forEach((level) => distribution.set(level, 0));

  questions.forEach((question) => {
    const level = question.taxonomyLevel.toLowerCase();
    distribution.set(level, (distribution.get(level) || 0) + 1);
  });

  // Check if any level has zero questions
  return Array.from(distribution.values()).every((count) => count > 0);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = await auth();

    const supabase = await createClient();

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

    if (body.inputMethod === "file" && body.fileUrl) {
      const fileResponse = await fetch(body.fileUrl);
      const fileBlob = await fileResponse.blob();

      let extractedText = "";

      // Determine file type and extract text accordingly
      if (fileBlob.type === "application/pdf") {
        const loader = new WebPDFLoader(fileBlob);
        const docs = await loader.load();
        extractedText = docs.map((doc) => doc.pageContent).join("\n");
      } else if (
        fileBlob.type === "application/msword" ||
        fileBlob.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const arrayBuffer = await fileBlob.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      }

      // Use extracted text as the topic
      body.topic = extractedText;
    }

    if (
      !body.topic ||
      !body.taxonomyLevels ||
      body.taxonomyLevels.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields: topic and taxonomyLevels" },
        { status: 400 }
      );
    }

    // Perform content checks (skip if using approved content)
    let violations = {};
    let shouldProceed = true;

    if (!shouldSkipContentChecks) {
      const result = await performContentChecks(body.topic);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed) {
      const { data, error } = await supabase
        .from("mcq_generator_results")
        .insert({
          user_id: userId,
          topic: body.topic,
          difficulty: body.difficulty,
          total_questions: body.totalQuestions,
          taxonomy_levels: body.taxonomyLevels,
          questions_data: [],
        })
        .select()
        .single();

      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: body.topic.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "mcq_generator",
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

    const targetQuestionCount = body.questionCount || 5;
    const batchCount = Math.ceil(targetQuestionCount / BATCH_SIZE);
    const batches = [];

    // Generate questions in batches
    for (let i = 0; i < batchCount; i++) {
      const remainingQuestions = targetQuestionCount - i * BATCH_SIZE;
      const currentBatchSize = Math.min(BATCH_SIZE, remainingQuestions);

      const batch = await generateQuestionBatch(
        currentBatchSize,
        body.topic,
        body.taxonomyLevels,
        body.difficulty,
        body.answersPerQuestion
      );
      batches.push(batch);
    }

    // Merge and deduplicate questions
    const mergedQuestions = mergeAndDeduplicateQuestions(batches);

    // If we don't have enough questions after deduplication, generate more
    while (mergedQuestions.length < targetQuestionCount) {
      const additionalBatch = await generateQuestionBatch(
        targetQuestionCount - mergedQuestions.length,
        body.topic,
        body.taxonomyLevels,
        body.difficulty,
        body.answersPerQuestion
      );

      // Check if additionalBatch has valid questions
      if (additionalBatch && Array.isArray(additionalBatch.questions)) {
        const newQuestions = additionalBatch.questions.filter(
          (question: any) =>
            question && question.text &&
            !mergedQuestions.some((q) => areQuestionsSimilar(q, question))
        );
        mergedQuestions.push(...newQuestions);
      } else {
        // If no valid questions in batch, break to avoid infinite loop
        console.error("Failed to generate additional questions");
        break;
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a text summarizer. use UK english",
        },
        {
          role: "user",
          content: `Summarize this piece of text and extract topic from the context: ${body.topic} and output in this json format {topic: "string"}`,
        },
      ],
    });

    const responseContent = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(responseContent || "{}");

    // Create final response object
    const finalResponse = {
      questions: mergedQuestions.slice(0, targetQuestionCount),
      metadata: {
        topic: parsedResponse.topic || body.topic,
        difficulty: body.difficulty,
        totalQuestions: targetQuestionCount,
        taxonomyLevels: body.taxonomyLevels,
        timestamp: new Date().toISOString(),
      },
    };

    // Store in Supabase
    const { data, error } = await supabase
      .from("mcq_generator_results")
      .insert({
        user_id: userId,
        topic: finalResponse.metadata.topic,
        difficulty: finalResponse.metadata.difficulty,
        total_questions: finalResponse.metadata.totalQuestions,
        taxonomy_levels: finalResponse.metadata.taxonomyLevels,
        questions_data: finalResponse.questions,
      })
      .select();

    if (error) {
      console.error("Supabase storage error:", error);
      return NextResponse.json(
        { error: "Failed to store MCQ results" },
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
      input_length: body.topic.length,
      response_length: completion.choices[0].message.content?.length || 0,
      startTime: new Date(),
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "mcq_generator",
      prompt_id: data[0].id,
      flagged: false,
      status_code: 200,
    });

    return NextResponse.json({ data: data[0] }, { status: 200 });
  } catch (error) {
    console.error("Error generating MCQs:", error);
    let errorMessage = "Failed to generate MCQs";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
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
    const approvedId = searchParams.get("approved");

    if (!approvedId) {
      return NextResponse.json(
        { error: "Invalid approved ID" },
        { status: 400 }
      );
    }

    // First get the metrics record to get the actual MCQ generator ID
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

    // Then get the actual MCQ using the prompt_id from metrics
    const { data: mcqData, error: mcqError } = await supabase
      .from("mcq_generator_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (mcqError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve MCQ data",
          message: mcqError.message,
        },
        { status: 404 }
      );
    }

    if (!mcqData) {
      return NextResponse.json(
        { error: "MCQ data not found" },
        { status: 404 }
      );
    }

    // Return the MCQ data in a structured format
    return NextResponse.json({
      questions_data: mcqData.questions_data,
      input_data: {
        topic: mcqData.topic,
        taxonomyLevels: mcqData.taxonomy_levels,
        questionCount: mcqData.total_questions,
        difficulty: mcqData.difficulty,
        inputMethod: mcqData.input_method || 'text',
        fileUrl: mcqData.file_url || ''
      },
      metadata: {
        id: mcqData.id,
        created_at: mcqData.created_at,
        last_edited: mcqData.updated_at,
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
