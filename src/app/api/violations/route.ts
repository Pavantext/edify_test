import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const tableMapping: Record<string, { table: string; inputColumn: string; }> = {
    lesson_plan: { table: "lesson_plan_results", inputColumn: "input_topic" },
    prompt_generator: { table: "prompt_generator_results", inputColumn: "input_original_prompt" },
    long_qa: { table: "long_qa_generator_results", inputColumn: "input_topic" },
    chat: { table: "chat_metrics", inputColumn: "prompt_text" },
    peel_generator: { table: "peel_generator_results", inputColumn: "topic" },
    mcq_generator: { table: "mcq_generator_results", inputColumn: "topic" },
    report_generator: { table: "report_generator_results", inputColumn: "strengths" },
    clarify_or_challenge: { table: "clarify_or_challenge", inputColumn: "input_text" },
    perspective_challenge: { table: "perspective_challenge_results", inputColumn: "input" },
    rubric_generator: { table: "rubrics_generator_results", inputColumn: "topic" },
    sow_generator: { table: "sow_generator_results", inputColumn: "topic" },
    quiz_generator: { table: "quiz_generator_results", inputColumn: "topic" },
    lesson_plan_evaluator: { table: "lesson_plan_evaluations", inputColumn: "name" },
};

export async function GET(req: Request): Promise<NextResponse> {
    try {
        const url = new URL(req.url);
        const fromDate = url.searchParams.get('from');
        const toDate = url.searchParams.get('to');

        const { userId, orgId, orgRole } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        const supabase = await createClient();

        let userIdsToFetch: string[] = [userId];
        if (orgId && orgRole === "org:admin") {
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

            userIdsToFetch = orgUsers.map((user: any) => user.user_id);
        }

        let metricsQuery = supabase
            .from("ai_tools_metrics")
            .select("*")
            .in("user_id", userIdsToFetch)
            .eq("flagged", true)
            .not("prompt_id", "is", null);

        if (fromDate) {
            metricsQuery = metricsQuery.gte('timestamp', `${fromDate}T00:00:00.000Z`);
        }

        if (toDate) {
            metricsQuery = metricsQuery.lte('timestamp', `${toDate}T23:59:59.999Z`);
        }

        const { data: metricsData, error: metricsError } = await metricsQuery;

        if (metricsError) {
            console.error("Error fetching metrics:", metricsError);
            return NextResponse.json({ error: metricsError.message }, { status: 500 });
        }

        if (!metricsData || metricsData.length === 0) {
            return NextResponse.json({ message: "No violations found." });
        }

        const uniqueUserIds = Array.from(new Set(metricsData.map((r: any) => r.user_id)));
        const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, username")
            .in("id", uniqueUserIds);

        if (usersError) {
            console.error("Error fetching usernames:", usersError);
            return NextResponse.json({ error: usersError.message }, { status: 500 });
        }

        const usernameMap = new Map(usersData?.map((u: any) => [u.id, u.username]) || []);

        const results = await Promise.all(
            metricsData.map(async (metric: any) => {
                const mapping = tableMapping[metric.prompt_type];
                if (!mapping) return null;
                const { table, inputColumn } = mapping;
                const { data, error } = await supabase
                    .from(table)
                    .select(`id, ${inputColumn}`)
                    .eq("id", metric.prompt_id)
                    .single();

                if (error) {
                    console.error(`Error fetching prompt data from ${table}:`, error);
                    return null;
                }

                const violations: string[] = [];
                if (metric.content_flags?.pii_detected) violations.push("PII Detected");
                if (metric.content_flags?.bias_detected) violations.push("Bias Detected");
                if (metric.content_flags?.content_violation) violations.push("Content Violation");
                if (metric.content_flags?.prompt_injection_detected) violations.push("Prompt Injection");
                if (metric.content_flags?.fraudulent_intent_detected) violations.push("Fraudulent Intent");
                if (metric.content_flags?.misinformation_detected) violations.push("Misinformation");
                if (metric.content_flags?.automation_misuse_detected) violations.push("Automation Misuse");

                return {
                    id: metric.id,
                    tool: metric.prompt_type,
                    input: data ? (data as Record<string, any>)[inputColumn] || "N/A" : "N/A",
                    violations,
                    username: (() => {
                        const uname = usernameMap.get(metric.user_id) || "Unknown";
                        const lastUnderscore = uname.lastIndexOf('_');
                        return lastUnderscore !== -1 ? uname.substring(0, lastUnderscore) : uname;
                    })(),
                    timestamp: metric.timestamp,
                };
            })
        );

        const formattedViolations = results.filter(Boolean);
        return NextResponse.json(formattedViolations);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}