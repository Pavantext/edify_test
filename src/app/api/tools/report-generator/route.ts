import { NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/api-client";
import { reportGeneratorSchema } from "@/schemas/report-generator-schema";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";
import openai from "@/lib/openai";
import { performContentChecks, recordAIToolsMetrics } from "@/lib/violation";
import { calculateGBPPrice } from "@/lib/exchange-service";
import { sendEmail } from "@/lib/email-service";

interface StudentDetails {
  studentId: any;
  strengths: string;
  areasOfDevelopment: string;
  progress: string;
}

interface RequestBody {
  studentDetails: StudentDetails;
  config?: {
    wordCount: number;
  };
}

export const maxDuration = 299; // Maximum execution time

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const approvedId = searchParams.get("approved");

    // If we have an approved ID, skip all validations and content checks
    if (approvedId) {
      const supabase = await createClient();
      
      // First get the metrics record to get the actual report ID
      const { data: metricsData, error: metricsError } = await supabase
        .from("ai_tools_metrics")
        .select("*")
        .eq("id", approvedId)
        .single();

      if (metricsError || !metricsData) {
        return NextResponse.json(
          { error: "Approved content not found" },
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

      // Get the actual report using the prompt_id from metrics
      const { data: reportData, error: reportError } = await supabase
        .from("report_generator_results")
        .select("*")
        .eq("id", metricsData.prompt_id)
        .single();

      if (reportError || !reportData) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }

      // Generate the report content if it's not already generated
      if (!reportData.complete_report) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `Use UK English only and do not use convoluted language. You are an educational professional who writes detailed student progress reports. You must respond with a valid JSON object that exactly matches the specified schema structure. Do not include any additional text or explanations outside the JSON object.`,
              },
              {
                role: "user",
                content: `Generate a student progress report with the following details:
                  Student Details:
                  - Student ID: ${reportData.student}
                  - Strengths: ${reportData.strengths}
                  - Areas of Development: ${reportData.areas_of_development}
                  - Progress: ${reportData.progress}

                  The completeReport field in the output JSON must strictly follow this format with exactly 300 words total. Each section must be formatted exactly as shown below with the specified headers and newlines:

                  1. Overall Assessment:
                  Provide a comprehensive overview of the student's general performance and understanding. This section should highlight key strengths while maintaining a balanced perspective.

                  2. Progress:
                  Detail specific improvements and achievements, focusing on measurable progress in key areas.

                  3. Target Steps in the Report:
                  Outline 2-3 specific, actionable targets for future development. Each target should be clear and achievable.

                  Suggestions for Improvement:
                  To support the pupil in achieving this target, I recommend the following strategies:
                  1. [First specific strategy with practical implementation steps]
                  2. [Second specific strategy with practical implementation steps]
                  3. [Third specific strategy with practical implementation steps]
                  4. Active participation in [specific activity] to enhance their analytical skills.`,
              },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
          });

          const response = JSON.parse(completion.choices[0].message.content || "{}");
          
          // Update the report with the generated content
          const { error: updateError } = await supabase
            .from("report_generator_results")
            .update({
              complete_report: response.completeReport || response.data?.completeReport || "",
              metadata: {
                ...(response.metadata || response.data?.metadata || {}),
                student: reportData.student,
                generatedAt: new Date().toISOString(),
                version: "1.0",
              },
            })
            .eq("id", reportData.id);

          if (updateError) {
            console.error("Error updating report:", updateError);
          } else {
            // Refresh the report data with updated content
            const { data: updatedReport } = await supabase
              .from("report_generator_results")
              .select("*")
              .eq("id", reportData.id)
              .single();
            
            if (updatedReport) {
              reportData.complete_report = updatedReport.complete_report;
              reportData.metadata = updatedReport.metadata;
            }
          }
        } catch (error) {
          console.error("Error generating report content:", error);
        }
      }

      return NextResponse.json({
        data: reportData,
        input_data: {
          student: reportData.student,
          strengths: reportData.strengths,
          areasOfDevelopment: reportData.areas_of_development,
          progress: reportData.progress
        },
        isApproved: true
      });
    }

    // Rest of the existing POST logic for non-approved requests
    const body = await req.json();

    // Validate request body
    if (!body.studentDetails) {
      return NextResponse.json(
        { error: "Missing required student details" },
        { status: 400 }
      );
    }

    // Validate student details
    const { studentId, strengths, areasOfDevelopment, progress } =
      body.studentDetails;
    if (
      !studentId?.trim() ||
      !strengths?.trim() ||
      !areasOfDevelopment?.trim() ||
      !progress?.trim()
    ) {
      return NextResponse.json(
        { error: "All student details fields are required" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();
    if (!supabase) {
      throw new Error("Failed to initialize database connection");
    }

    const input_report = body.studentDetails.studentId + 
                        body.studentDetails.strengths + 
                        body.studentDetails.areasOfDevelopment + 
                        body.studentDetails.progress;

    // Skip content checks if we have an approved ID
    let violations = {};
    let shouldProceed = true;

    if (!approvedId) {
      // Only perform content checks if we don't have an approved ID
      const result = await performContentChecks(input_report);
      violations = result.violations;
      shouldProceed = result.shouldProceed;
    }

    if (!shouldProceed && !approvedId) {
      const { data, error: supabaseError } = await supabase
        .from("report_generator_results")
        .insert({
          user_id: userId,
          student: body.studentDetails.studentId,
          strengths: body.studentDetails.strengths,
          areas_of_development: body.studentDetails.areasOfDevelopment,
          progress: body.studentDetails.progress,
          complete_report: "",
          metadata: null,
        })
        .select()
        .single();

      // Record the violations in the database
      await recordAIToolsMetrics({
        userId: userId!,
        model: "gpt-4o",
        input_length: input_report.length,
        response_length: 0,
        startTime: new Date(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        price_gbp: 0,
        error_type: "content_violation",
        status_code: 400,
        contentFlags: violations as any,
        prompt_type: "report_generator",
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

    // AI Prompt
    const systemMessage = `Use UK English only and do not use convoluted language. You are an educational professional who writes detailed student progress reports. You must respond with a valid JSON object that exactly matches the specified schema structure. Do not include any additional text or explanations outside the JSON object.`;

    const userMessage = `Generate a student progress report with the following details:
    
    Student Details:
    - Student ID: ${body.studentDetails.studentId}
    - Strengths: ${body.studentDetails.strengths}
    - Areas of Development: ${body.studentDetails.areasOfDevelopment}
    - Progress: ${body.studentDetails.progress}

    The completeReport field in the output JSON must strictly follow this format with exactly ${
      body.config?.wordCount || 300
    } words total. Each section must be formatted exactly as shown below with the specified headers and newlines:

    1. Overall Assessment:
    Provide a comprehensive overview of the student's general performance and understanding. This section should highlight key strengths while maintaining a balanced perspective.

    2. Progress:
    Detail specific improvements and achievements, focusing on measurable progress in key areas.

    3. Target Steps in the Report:
    Outline 2-3 specific, actionable targets for future development. Each target should be clear and achievable.

    Suggestions for Improvement:
    To support the pupil in achieving this target, I recommend the following strategies:
    1. [First specific strategy with practical implementation steps]
    2. [Second specific strategy with practical implementation steps]
    3. [Third specific strategy with practical implementation steps]
    4. Active participation in [specific activity] to enhance their analytical skills.
  
    Return ONLY a JSON object with this exact structure:
    {
      "data": {
          "completeReport": "string" (Must follow the above format exactly with all section headers and newlines preserved),
          "metadata": {
            "student": "string",
            "generatedAt": "string",
            "wordCount": number,
            "version": "string"
          }
        }
      }
    }`;

    // Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");

    // Format the current date and time in UK format
    const now = new Date();
    const formattedDate = now
      .toLocaleString("en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      })
      .replace(/\//g, "-");

    // Store report in Supabase
    const { data, error: supabaseError } = await supabase
      .from("report_generator_results")
      .insert({
        user_id: userId,
        student: body.studentDetails.studentId,
        strengths: body.studentDetails.strengths,
        areas_of_development: body.studentDetails.areasOfDevelopment,
        progress: body.studentDetails.progress,
        complete_report: response.data.completeReport,
        metadata: {
          ...response.data.metadata,
          student: body.studentDetails.studentId,
          generatedAt: formattedDate,
          version: "1.0",
        },
      })
      .select()
      .single();

    if (supabaseError) {
      console.error("Database error:", supabaseError);
      throw new Error("Failed to store report in database");
    }

    if (!data) {
      throw new Error("No data returned from database");
    }

    const price = await calculateGBPPrice(
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0,
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
      prompt_type: "report_generator",
      prompt_id: data.id,
      flagged: false,
      status_code: 200,
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in report generation:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

// Add GET endpoint to fetch reports by ID
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

    // First get the metrics record to get the actual report ID
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

    // Then get the actual report using the prompt_id from metrics
    const { data: reportData, error: reportError } = await supabase
      .from("report_generator_results")
      .select("*")
      .eq("id", metricsData.prompt_id)
      .single();

    if (reportError) {
      return NextResponse.json(
        {
          error: "Failed to retrieve report",
          message: reportError.message,
        },
        { status: 404 }
      );
    }

    if (!reportData) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // If this is an approval request, send email to user
    if (approvedId) {
      try {
        // Make sure the user email is valid before sending
        if (reportData.user_email || userId) {
          const userEmail = reportData.user_email || `${userId}@clerk.com`;
          await sendEmail({
            to: userEmail,
            subject: "Your Report Generator Results Have Been Approved",
            text: `Your report has been approved by the moderator. View it at: ${process.env.NEXT_PUBLIC_APP_URL}/tools/report-generator?approved=${approvedId}`,
            html: `<p>Your report has been approved by the moderator. <a href="${process.env.NEXT_PUBLIC_APP_URL}/tools/report-generator?approved=${approvedId}">View it here</a></p>`,
            metadata: {
              tool: "report_generator",
              userId: reportData.user_id,
              topic: reportData.student
            },
          });
        } else {
          console.warn("Could not send approval email: Invalid user email address");
        }
      } catch (error) {
        console.error("Error sending approval email:", error);
        // Continue processing even if email fails
      }
    }

    // Generate the report content if it's not already generated
    if (!reportData.complete_report) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Use UK English only and do not use convoluted language. You are an educational professional who writes detailed student progress reports. You must respond with a valid JSON object that exactly matches the specified schema structure. Do not include any additional text or explanations outside the JSON object.`,
            },
            {
              role: "user",
              content: `Generate a student progress report with the following details:
                Student Details:
                - Student ID: ${reportData.student}
                - Strengths: ${reportData.strengths}
                - Areas of Development: ${reportData.areas_of_development}
                - Progress: ${reportData.progress}

                The completeReport field in the output JSON must strictly follow this format with exactly 300 words total. Each section must be formatted exactly as shown below with the specified headers and newlines:

                1. Overall Assessment:
                Provide a comprehensive overview of the student's general performance and understanding. This section should highlight key strengths while maintaining a balanced perspective.

                2. Progress:
                Detail specific improvements and achievements, focusing on measurable progress in key areas.

                3. Target Steps in the Report:
                Outline 2-3 specific, actionable targets for future development. Each target should be clear and achievable.

                Suggestions for Improvement:
                To support the pupil in achieving this target, I recommend the following strategies:
                1. [First specific strategy with practical implementation steps]
                2. [Second specific strategy with practical implementation steps]
                3. [Third specific strategy with practical implementation steps]
                4. Active participation in [specific activity] to enhance their analytical skills.`,
            },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        });

        const response = JSON.parse(completion.choices[0].message.content || "{}");
        
        // Update the report with the generated content
        const { error: updateError } = await supabase
          .from("report_generator_results")
          .update({
            complete_report: response.completeReport || response.data?.completeReport || "",
            metadata: {
              ...(response.metadata || response.data?.metadata || {}),
              student: reportData.student,
              generatedAt: new Date().toISOString(),
              version: "1.0",
            },
          })
          .eq("id", reportData.id);

        if (updateError) {
          console.error("Error updating report:", updateError);
        } else {
          // Refresh the report data with updated content
          const { data: updatedReport } = await supabase
            .from("report_generator_results")
            .select("*")
            .eq("id", reportData.id)
            .single();
          
          if (updatedReport) {
            reportData.complete_report = updatedReport.complete_report;
            reportData.metadata = updatedReport.metadata;
          }
        }
      } catch (error) {
        console.error("Error generating report content:", error);
      }
    }

    return NextResponse.json({
      data: reportData,
      input_data: {
        student: reportData.student,
        strengths: reportData.strengths,
        areasOfDevelopment: reportData.areas_of_development,
        progress: reportData.progress
      },
      isApproved: true
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
