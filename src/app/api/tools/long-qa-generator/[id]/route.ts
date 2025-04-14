import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { sendEmail } from "@/lib/email-service";

// GET endpoint to fetch questions by ID
export async function GET(
    request: NextRequest
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        console.log("All search params:", Object.fromEntries(url.searchParams));

        // Get the ID from the path
        const id = request.nextUrl.pathname.split("/").pop();
        const approvedId = url.searchParams.get("approved");

        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        const supabase = await createClient();
        
        // First try to get the result directly
        let result = null;
        let metricsData = null;

        // Try to get the result directly first
        const { data: directResult, error: directError } = await supabase
            .from("long_qa_generator_results")
            .select("*")
            .eq("id", id)
            .single();

        if (directError) {
            // If direct query fails, try through metrics
            const { data: metrics, error: metricsError } = await supabase
                .from("ai_tools_metrics")
                .select("*")
                .eq("id", id)
                .single();

            if (metricsError || !metrics) {
                console.error("Metrics error:", metricsError);
                return NextResponse.json(
                    { error: "Questions not found" },
                    { status: 404 }
                );
            }

            metricsData = metrics;

            // Check if content is approved
            if (metrics.moderator_approval !== 'approved') {
                return NextResponse.json(
                    {
                        error: "Content not approved",
                        details: {
                            status: metrics.moderator_approval,
                            contentFlags: metrics.content_flags
                        }
                    },
                    { status: 403 }
                );
            }

            // Get the result using the prompt_id from metrics
            const { data: metricsResult, error: resultError } = await supabase
                .from("long_qa_generator_results")
                .select("*")
                .eq("id", metrics.prompt_id)
                .single();

            if (resultError || !metricsResult) {
                console.error("Result error:", resultError);
                return NextResponse.json(
                    { error: "Questions not found" },
                    { status: 404 }
                );
            }

            result = metricsResult;
        } else {
            result = directResult;
        }

        // Log the structure of the results to help with debugging
        console.log("Result structure:", {
            hasAiGeneratedQuestions: !!result.ai_generated_questions,
            questionCount: result.ai_generated_questions?.questions?.length || 0,
            resultId: result.id,
            metricsId: id
        });

        // Make sure we have a valid questions object
        let aiGeneratedQuestions = result.ai_generated_questions || { questions: [] };
        
        // Ensure the questions array exists
        if (typeof aiGeneratedQuestions === 'string') {
            try {
                // If it's a string (serialized JSON), try to parse it
                aiGeneratedQuestions = JSON.parse(aiGeneratedQuestions);
            } catch (e) {
                console.error("Failed to parse questions JSON:", e);
                // If parsing fails, create a default structure
                aiGeneratedQuestions = { questions: [] };
            }
        }
        
        // If questions is missing, add an empty array
        if (!aiGeneratedQuestions.questions) {
            aiGeneratedQuestions.questions = [];
        }

        // If this is an approval request, send email to user
        if (approvedId) {
            try {
                // Make sure the user email is valid before sending
                if (result.user_email || userId) {
                    const userEmail = result.user_email || `${userId}@clerk.com`;
                    await sendEmail({
                        to: userEmail,
                        subject: "Your Long QA Generator Results Have Been Approved",
                        text: `Your questions have been approved by the moderator. View them at: ${process.env.NEXT_PUBLIC_APP_URL}/tools/long-qa-generator?approved=${id}`,
                        html: `<p>Your questions have been approved by the moderator. <a href="${process.env.NEXT_PUBLIC_APP_URL}/tools/long-qa-generator?approved=${id}">View them here</a></p>`,
                        metadata: {
                            tool: "long_qa",
                            userId: result.user_id,
                            topic: result.input_topic
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

        return NextResponse.json({
            ai_generated_questions: aiGeneratedQuestions,
            id: result.id,
            input_data: {
                topic: result.input_topic,
                levels: result.input_levels,
                numberOfQuestions: result.number_of_questions,
                complexity: result.complexity,
                questionType: result.question_type || "",
                language: result.language || "",
                customInstructions: result.custom_instructions || ""
            },
            isApproved: true
        });
    } catch (error) {
        console.error("Error fetching questions:", error);
        return NextResponse.json(
            { error: "Failed to fetch questions" },
            { status: 500 }
        );
    }
}

// PUT endpoint to update questions
export async function PUT(
    request: NextRequest,
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const id = request.nextUrl.pathname.split("/").pop();
        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        const body = await request.json();
        const { questions } = body;

        const supabase = await createClient();
        
        // First try to get the result directly
        let resultId = id;

        // Try to get the result directly first
        const { data: directResult, error: directError } = await supabase
            .from("long_qa_generator_results")
            .select("id")
            .eq("id", id)
            .single();

        if (directError) {
            // If direct query fails, try through metrics
            const { data: metricsData, error: metricsError } = await supabase
                .from("ai_tools_metrics")
                .select("prompt_id")
                .eq("id", id)
                .single();

            if (metricsError || !metricsData) {
                return NextResponse.json(
                    { error: "Questions not found" },
                    { status: 404 }
                );
            }

            resultId = metricsData.prompt_id;
        }

        // Update the questions
        const { data: result, error: updateError } = await supabase
            .from("long_qa_generator_results")
            .update({
                ai_generated_questions: { questions },
            })
            .eq("id", resultId)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error updating questions:", error);
        return NextResponse.json(
            { error: "Failed to update questions" },
            { status: 500 }
        );
    }
} 