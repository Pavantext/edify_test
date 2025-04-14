// File: app/api/tools/rubric-generator/route.ts

import { NextResponse } from "next/server";

import { RubricResponseSchema } from "@/schemas/rubric-schema";

import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/utils/supabase/server";

import openai from "@/lib/openai";

import { string } from "zod";

import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";

import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import mammoth from "mammoth";
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

    // First get the metrics record to get the actual rubric ID
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

    // Then get the actual rubric using the prompt_id from metrics
    const { data: rubricData, error: rubricError } = await supabase
      .from("rubrics_generator_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (rubricError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve rubric",
          message: rubricError.message,
        },
        { status: 404 }
      );
    }

    if (!rubricData) {
      return NextResponse.json(
        { error: "Rubric not found" },
        { status: 404 }
      );
    }

    let rubric;
    try {
      // Check if the rubric is empty or null
      if (!rubricData.ai_response || rubricData.ai_response === '') {
        return NextResponse.json({
          data: null,
          input_data: {
            topic: rubricData.topic,
            yearGroup: rubricData.year_group,
            keyStage: rubricData.key_stage,
            assignmentType: rubricData.assignment_type,
            customAssignmentType: rubricData.custom_assignment_type,
            assessmentType: rubricData.assessment_type,
            criteria: rubricData.criteria
          },
          metadata: {
            id: rubricData.id,
            created_at: rubricData.created_at,
            last_edited: rubricData.updated_at,
            moderator_approval: metricsData.moderator_approval
          }
        });
      }

      rubric = JSON.parse(rubricData.ai_response);
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid rubric data format",
          message: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 500 }
      );
    }

    const response = {
      data: rubric.data,
      input_data: {
        topic: rubricData.topic,
        yearGroup: rubricData.year_group,
        keyStage: rubricData.key_stage,
        assignmentType: rubricData.assignment_type,
        customAssignmentType: rubricData.custom_assignment_type,
        assessmentType: rubricData.assessment_type,
        criteria: rubricData.criteria
      },
      metadata: {
        id: rubricData.id,
        created_at: rubricData.created_at,
        last_edited: rubricData.updated_at,
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

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { userId } = await auth();

    // Get approved ID from URL if present
    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approvedId");

    const body = await req.json();

    // Extract text from uploaded document if present
    let documentText = "";
    if (body.inputMethod === "file" && body.fileUrl) {
      const fileResponse = await fetch(body.fileUrl);
      const fileBlob = await fileResponse.blob();

      // Extract text based on file type
      if (fileBlob.type === "application/pdf") {
        documentText = await extractTextFromPDF(fileBlob);
      } else if (
        fileBlob.type === "application/msword" ||
        fileBlob.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        documentText = await extractTextFromDOC(fileBlob);
      }
    }

    // Validate required fields

    if (
      !body.assignmentType ||
      !body.keyStage ||
      !body.criteria ||
      !body.topic
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: assignmentType, keyStage, criteria, and topic",
        },

        { status: 400 }
      );
    }

    // Schema description for OpenAI

    const schemaDescription = `

    The response must exactly match this JSON schema structure:

    {

      "data": {

        "id": "string (UUID)",

        "version": "string (e.g., '1.0')",

        "createdAt": "string (ISO date)",

        "metadata": {

          "subject": "string",

          "topic": "string",

          "assessmentType": "string",

          "assessor": "string",

          "keyStage": "string",

          "level": "number"

        },

        "rubric": {

          "criteria": [

            {

              "name": "string",

              "levels": {

                "exceptional": {

                  "score": 5,

                  "description": "string",

                  "feedback": "string"

                },

                "advanced": {

                  "score": 4,

                  "description": "string",

                  "feedback": "string"

                },

                "proficient": {

                  "score": 3,

                  "description": "string",

                  "feedback": "string"

                },

                "basic": {

                  "score": 2,

                  "description": "string",

                  "feedback": "string"

                },

                "emerging": {

                  "score": 1,

                  "description": "string",

                  "feedback": "string"

                }

              }

            }

          ]

        }

      }

    }



    Example response structure:

    {

      "data": {

        "id": "550e8400-e29b-41d4-a716-446655440000",

        "version": "1.0",

        "createdAt": "2024-02-05T12:00:00.000Z",

        "metadata": {

          "subject": "Art and Design",

          "topic": "Creating Abstract Paintings Using Texture",

          "assessmentType": "Practical Project",

          "assessor": "Self",

          "keyStage": "ks4",

          "level": 4

        },

        "rubric": {

          "criteria": [

            {

              "name": "Creativity",

              "levels": {

                "advanced": {

                  "score": 4,

                  "description": "Demonstrates exceptional originality and innovative use of texture.",

                  "feedback": "Your work shows remarkable creativity in texture application. Consider exploring even more unconventional materials."

                },

                "proficient": {

                  "score": 3,

                  "description": "Shows creativity with some innovative elements in texture or composition.",

                  "feedback": "Good use of creative elements. Try pushing boundaries further with texture combinations."

                },

                "basic": {

                  "score": 2,

                  "description": "Limited originality; relies on basic techniques without exploring new ideas.",

                  "feedback": "Work shows basic understanding. Experiment with different textures to enhance creativity."

                },

                "emerging": {

                  "score": 1,

                  "description": "Minimal creativity or evidence of effort; heavily derivative.",

                  "feedback": "Focus on developing your unique artistic voice. Start with simple texture experiments."

                }

              }

            }

          ]

        }

      }

    }`;

    // Prepare system message for OpenAI

    const systemMessage = `You are an educational assessment expert who creates detailed rubrics.
    Use UK English only and avoid convoluted language.
    
    You must respond with a valid JSON object that exactly matches the specified schema structure.

    Do not include any additional text or explanations outside the JSON object.

    ${schemaDescription}

    

    The response should include:

    1. Detailed criteria descriptions

    2. Specific feedback for each level

    3. Actionable suggestions for improvement

    4. Clear instructions for teachers and students

    5. Appropriate language for the specified key stage

    

    Important notes:

    - Use UK English spelling and terminology

    - Avoid convoluted language

    - Ensure feedback is constructive and actionable

    - Match the academic level to the key stage

    - Generate a unique UUID for the id field

    - Use current timestamp for createdAt

    - For Key Stage 3, include only levels 1-3 (emerging to proficient)

    - For Key Stage 4, include levels 1-4 (emerging to advanced)

    - For Key Stage 5, include all levels 1-5 (emerging to exceptional)

    ${documentText
        ? "Additional Context: Use the provided document text to inform the rubric criteria and descriptions."
        : ""
      }`;

    // Prepare user message for OpenAI

    const userMessage = `Create an assessment rubric with the following details:

    

    Assignment Details:

    - Type: ${body.assignmentType}

    - Topic: ${body.topic}

    ${body.customAssignmentType
        ? `- Custom Type: ${body.customAssignmentType}`
        : ""
      }

    - Key Stage: ${body.keyStage}

    - Year Group: ${body.yearGroup}

    - Assessment Type: ${body.assessmentType}

    ${body.fileUrl ? `- Document URL: ${body.fileUrl}` : ""}

    Required Criteria: ${body.criteria.join(", ")}

    ${body.additionalInstructions
        ? `Additional Instructions: ${body.additionalInstructions}`
        : ""
      }

    ${documentText
        ? `Document Content Summary: ${documentText.substring(0, 1000)}...`
        : ""
      }`;

    // Perform content checks only if we don't have an approved ID
    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      // Only perform content checks if we don't have an approved ID
      const result = await performContentChecks(userMessage);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed) {
      const { data, error } = await supabase
        .from("rubrics_generator_results")
        .insert({
          user_id: userId,
          assignment_type: body.assignmentType || " ",
          custom_assignment_type: body.customAssignmentType || " ",
          key_stage: body.keyStage || " ",
          year_group: body.yearGroup || " ",
          assessment_type: body.assessmentType || " ",
          topic: body.topic || " ",
          criteria: body.criteria || " ",
          additional_instructions: body.additionalInstructions || " ",
          ai_response: "",
          document_text: documentText || null,
        })
        .select()
        .single();
      // Record the violations in the database

      await recordAIToolsMetrics({
        userId: userId!,

        model: "gpt-4o",

        input_length: (systemMessage + userMessage).length,

        response_length: 0,

        startTime: new Date(),

        inputTokens: 0,

        outputTokens: 0,

        totalTokens: 0,

        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,

        contentFlags: violations as any,

        prompt_type: "rubric_generator",

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

    try {
      // Generate rubric using OpenAI
      console.log("Generate rubric using OpenAI");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",

        messages: [
          { role: "system", content: systemMessage },

          { role: "user", content: userMessage },
        ],

        response_format: { type: "json_object" },
      });

      const aiResponse = completion.choices[0].message.content;
      console.log("Raw AI Response:", aiResponse); // Debug log

      if (!aiResponse || aiResponse.length === 0) {
        throw new Error("No response from OpenAI");
      }

      // Store in Supabase with document text if present
      const { data, error } = await supabase
        .from("rubrics_generator_results")
        .insert({
          user_id: userId,
          assignment_type: body.assignmentType || " ",
          custom_assignment_type: body.customAssignmentType || " ",
          key_stage: body.keyStage || " ",
          year_group: body.yearGroup || " ",
          assessment_type: body.assessmentType || " ",
          topic: body.topic || " ",
          criteria: body.criteria || " ",
          additional_instructions: body.additionalInstructions || " ",
          ai_response: aiResponse,
          document_text: documentText || null,
        })
        .select();

      if (error) {
        console.log(error);
        throw new Error(`Failed to store in database: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error("No data returned from database insert");
      }
      // Parse AI response and replace the ID with Supabase record ID
      const aiResponseObj = JSON.parse(aiResponse);
      console.log("Parsed AI Response:", aiResponseObj); // Debug log

      if (!aiResponseObj || !aiResponseObj.data) {
        throw new Error("Invalid AI response format");
      }

      const price = await calculateGBPPrice(
        completion.usage?.prompt_tokens || 0,
        completion.usage?.prompt_tokens || 0,
        "gpt-4o"
      );

      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: (systemMessage + userMessage).length,
        response_length: completion.choices[0].message.content?.length || 0,
        startTime: new Date(),
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        price_gbp: price,
        contentFlags: violations as any,
        prompt_type: "rubric_generator",
        prompt_id: data[0].id,
        flagged: false,

        status_code: 200,
      });

      // Return just the necessary data with Supabase ID
      return NextResponse.json({
        data: {
          id: data[0].id,
          rubric: aiResponseObj.data.rubric,
          metadata: aiResponseObj.data.metadata,
          version: aiResponseObj.data.version,
          createdAt: aiResponseObj.data.createdAt,
        },
      });
    } catch (parseError: any) {
      console.error("Error parsing AI response:", parseError);
      return NextResponse.json(
        {
          error: "Failed to process AI response",
          details: parseError?.message || "Unknown parsing error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error generating rubric:", error);

    let errorMessage = "Failed to generate rubric";

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
