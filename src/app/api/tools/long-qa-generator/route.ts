import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import mammoth from "mammoth";
import { calculateGBPPrice } from "@/lib/exchange-service";
import { sendEmail } from "@/lib/email-service";

export const maxDuration = 299; // Changed to 299 secs maximum

const COMPLEXITY_PROMPTS = {
  KS3: "Target the questions at Key Stage 3 level (ages 11-14), using appropriate vocabulary and concepts.",
  KS4: "Target the questions at Key Stage 4 level (ages 14-16), incorporating GCSE-level complexity and terminology.",
  Advanced:
    "Target the questions at advanced level, suitable for A-Level or undergraduate study.",
};

const BATCH_SIZE = 5;

// Add file validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Set a maximum context token limit for the model (adjust this value as required)
const MAX_CONTEXT_TOKENS = 8000;

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

// A simple helper function to approximately count tokens by splitting using whitespace.
// Note: For fine-grained estimation consider using a tokenizer that closely matches your model.
function approximateTokenCount(text: string): number {
  return text.split(/\s+/).length;
}

async function validateFile(fileBlob: Blob): Promise<void> {
  // Check file size
  if (fileBlob.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(fileBlob.type)) {
    throw new Error(`Invalid file type. Allowed types: PDF, DOC, DOCX`);
  }
}

async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    const loader = new WebPDFLoader(file);
    const docs = await loader.load();
    return docs.map((doc) => doc.pageContent).join("\n");
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF file. Please ensure the file is not corrupted.');
  }
}

async function extractTextFromDOC(file: Blob): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOC:', error);
    throw new Error('Failed to extract text from DOC/DOCX file. Please ensure the file is not corrupted.');
  }
}

async function generateQuestionsForLevel(
  topic: string,
  level: string,
  count: number,
  userId: string,
  complexity: "KS3" | "KS4" | "Advanced",
  documentContent?: string
) {
  const complexityPrompt = COMPLEXITY_PROMPTS[complexity];
  const contextPrompt = documentContent
    ? `Using the following document content as reference:\n\n${documentContent}\n\n`
    : "";

  // Calculate number of batches needed
  const numberOfBatches = Math.ceil(count / BATCH_SIZE);
  let allQuestions = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;

  // Generate questions in batches
  for (let i = 0; i < numberOfBatches; i++) {
    const remainingQuestions = count - i * BATCH_SIZE;
    const batchSize = Math.min(BATCH_SIZE, remainingQuestions);

    const prompt = `${contextPrompt}Generate ${batchSize} comprehensive questions for the topic "${topic}" focusing on the Bloom's taxonomy level: ${level}.

${complexityPrompt}

The questions must:
1. Be detailed and challenging for the specified level
2. Include a comprehensive example response that demonstrates mastery
3. Follow academic standards appropriate for ${complexity}
4. Be specific and actionable
5. Encourage critical thinking appropriate for the level

Response must be in valid JSON format matching this schema:
{
  "questions": [
    {
      "level": "string",
      "question": "string",
      "exampleResponse": "string"
    }
  ]
}`;

    // Check if the prompt exceeds our maximum context tokens
    const promptTokenCount = approximateTokenCount(prompt);
    if (promptTokenCount > MAX_CONTEXT_TOKENS) {
      throw new Error("Context length limit reached. Please reduce the input length or provide a shorter document.");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an educational assistant that generates questions based on Bloom's Taxonomy. Use UK English only and avoid convoluted language. Format all responses as valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    allQuestions.push(...(result.questions || []));

    // Track token usage
    totalPromptTokens += response.usage?.prompt_tokens || 0;
    totalCompletionTokens += response.usage?.completion_tokens || 0;
    totalTokens += response.usage?.total_tokens || 0;
  }

  return {
    questions: allQuestions,
    usage: {
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      total_tokens: totalTokens
    }
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if this is an approved request
    const url = new URL(request.url);
    const isApprovedRequest = url.searchParams.get("approved") === "true";

    const formData = await request.formData();
    const config = JSON.parse(formData.get("config") as string);
    const file = formData.get("file") as File | null;

    // Skip content checks for approved requests
    let violations = {};
    let shouldProceed = true;
    
    if (!isApprovedRequest) {
      // Perform content checks only if not an approved request
      const result = await performContentChecks(config.topic);
      violations = result.violations;
      shouldProceed = result.shouldProceed;

      if (!shouldProceed) {
        // Save the violation record
        const { data: violatedData, error: violatedError } = await supabase
          .from("long_qa_generator_results")
          .insert({
            user_id: userId,
            input_topic: config.topic,
            input_levels: config.levels,
            ai_generated_questions: "",
            complexity: config.complexity,
          })
          .select()
          .single();

        // Record the violations in the database
        await recordAIToolsMetrics({
          userId: userId!,
          model: "gpt-4o",
          input_length: config.topic.length,
          response_length: 0,
          startTime: new Date(),
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          price_gbp: 0,
          error_type: "content_violation",
          status_code: 400,
          contentFlags: violations as any,
          prompt_type: "long_qa",
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
    }

    let documentContent = "";

    if (file && !isApprovedRequest) {
      try {
        // Validate file before processing
        const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
        await validateFile(fileBlob);

        // Extract text based on file type
        if (file.type === "application/pdf") {
          documentContent = await extractTextFromPDF(fileBlob);
        } else if (
          file.type === "application/msword" ||
          file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          documentContent = await extractTextFromDOC(fileBlob);
        }

        // Validate extracted text
        if (!documentContent.trim()) {
          throw new Error('No text could be extracted from the file. Please ensure the file contains readable text.');
        }

        // Content check for document content
        const { violations: documentViolations, shouldProceed: documentShouldProceed, moderationResult } =
          (await performContentChecks(documentContent)) as ContentCheckResult;

        // Combine violations
        violations = { ...violations, ...documentViolations };

        if (
          !documentShouldProceed ||
          moderationResult?.content_violation ||
          Object.values(documentViolations).some((v) => v) ||
          moderationResult?.self_harm_detected ||
          moderationResult?.misinformation_detected ||
          moderationResult?.automation_misuse_detected
        ) {
          const { data, error } = await supabase
            .from("long_qa_generator_results")
            .insert({
              user_id: userId,
              input_topic: config.topic,
              input_levels: config.levels,
              ai_generated_questions: { questions: [] },
              complexity: config.complexity,
            })
            .select()
            .single();
          await recordAIToolsMetrics({
            userId,
            model: "gpt-4o",
            input_length: documentContent.length,
            response_length: 0,
            startTime: new Date(),
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            price_gbp: 0,
            error_type: "content_violation",
            status_code: 400,
            contentFlags: documentViolations as any,
            prompt_type: "long_qa",
            prompt_id: data.id,
            flagged: true,
          });

          // Get array of flagged violations
          const flaggedViolations = Object.entries(documentViolations)
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
      } catch (error) {
        console.error('Error processing file:', error);
        return NextResponse.json(
          { error: `File processing error: ${(error as Error).message}` },
          { status: 400 }
        );
      }
    } else if (file) {
      // For approved requests with file, just extract content without validation
      try {
        const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
        if (file.type === "application/pdf") {
          documentContent = await extractTextFromPDF(fileBlob);
        } else if (
          file.type === "application/msword" ||
          file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          documentContent = await extractTextFromDOC(fileBlob);
        }
      } catch (error) {
        console.error('Error processing file for approved request:', error);
        // Continue even if file processing fails for approved requests
      }
    }

    const allQuestions = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;

    for (const level of config.levels) {
      const result = await generateQuestionsForLevel(
        config.topic,
        level,
        config.numberOfQuestions,
        userId,
        config.complexity,
        documentContent
      );
      allQuestions.push(...result.questions);
      
      // Accumulate token usage
      totalPromptTokens += result.usage.prompt_tokens;
      totalCompletionTokens += result.usage.completion_tokens;
      totalTokens += result.usage.total_tokens;
    }

    const { data, error } = await supabase
      .from("long_qa_generator_results")
      .insert({
        user_id: userId,
        input_topic: config.topic,
        input_levels: config.levels,
        ai_generated_questions: { questions: allQuestions },
        complexity: config.complexity,
      })
      .select()
      .single();

    if (error) throw error;

    // Calculate price in GBP
    const price = await calculateGBPPrice(
      totalPromptTokens,
      totalCompletionTokens,
      "gpt-4o"
    );

    // Record metrics for successful generation
    await recordAIToolsMetrics({
      userId: userId!,
      model: "gpt-4o",
      input_length: config.topic.length + (documentContent?.length || 0),
      response_length: JSON.stringify(allQuestions).length,
      startTime: new Date(),
      inputTokens: totalPromptTokens,
      outputTokens: totalCompletionTokens,
      totalTokens: totalTokens,
      price_gbp: price,
      contentFlags: violations as any,
      prompt_type: "long_qa",
      prompt_id: data.id,
      flagged: false,
      status_code: 200,
    });

    // After successful generation, send email to user
    if (data) {
      await sendEmail({
        to: userId,
        subject: "Your Long QA Generator Results",
        text: `Your questions have been generated successfully. View them at: ${process.env.NEXT_PUBLIC_APP_URL}/tools/long-qa-generator/${data.id}/view`,
        html: `<p>Your questions have been generated successfully. <a href="${process.env.NEXT_PUBLIC_APP_URL}/tools/long-qa-generator/${data.id}/view">View them here</a></p>`,
        metadata: {
          tool: "long_qa",
          userId: userId,
          topic: config.topic
        },
      });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate questions" },
      { status: 500 }
    );
  }
}
