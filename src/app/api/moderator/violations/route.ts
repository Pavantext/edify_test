import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const tableMapping: Record<string, { table: string; inputColumn: string }> = {
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
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { userId, orgId, orgRole } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        // Define roles more explicitly
        const isModerator = orgRole === "moderator" || orgRole === "org:moderator";
        const isAdmin = orgRole === "org:admin";
        const isEducator = orgRole === "org:educator" || orgRole === "basic";

        // Check if user has a valid role
        if (!isModerator && !isAdmin && !isEducator) {
            return NextResponse.json({ error: "Unauthorized role" }, { status: 401 });
        }

        const supabase = await createClient();
        let query = supabase
            .from("ai_tools_metrics")
            .select("*", { count: 'exact' })
            .eq("flagged", true)
            .not("prompt_id", "is", null);

        // Apply role-specific filters
        if (isEducator) {
            // Educators can only see their own data
            query = query.eq("user_id", userId);
        } else if ((isModerator || isAdmin) && orgId) {
            // Moderators and admins can see org data
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

            const userIdsToFetch = orgUsers.map((user: any) => user.user_id);
            if (userIdsToFetch.length > 0) {
                query = query.in("user_id", userIdsToFetch);
            }
        }

        // Apply ordering and pagination
        query = query
            .order('timestamp', { ascending: false })
            .range(from, to);

        const { data: metricsData, error: metricsError, count } = await query;

        if (metricsError) {
            console.error("Error fetching metrics:", metricsError);
            return NextResponse.json({ error: metricsError.message }, { status: 500 });
        }

        if (!metricsData || metricsData.length === 0) {
            return NextResponse.json({
                violations: [],
                totalCount: 0,
                currentPage: page,
                pageSize: pageSize
            });
        }

        const uniqueUserIds = Array.from(new Set(metricsData.map((r: any) => r.user_id)));

        const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, username, email")
            .in("id", uniqueUserIds);

        if (usersError) {
            console.error("Error fetching user data:", usersError);
            return NextResponse.json({ error: usersError.message }, { status: 500 });
        }

        const userMap = new Map(
            usersData?.map((u: any) => [u.id, { username: u.username, email: u.email }]) || []
        );

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
                const content_flags = metric.content_flags || {};

                // Map content flags to violation types
                if (content_flags.pii_detected) violations.push("PII Detected");
                if (content_flags.bias_detected) violations.push("Bias Detected");
                if (content_flags.content_violation) violations.push("Content Violation");
                if (content_flags.prompt_injection_detected) violations.push("Prompt Injection");
                if (content_flags.fraudulent_intent_detected) violations.push("Fraudulent Intent");
                if (content_flags.misinformation_detected) violations.push("Misinformation");
                if (content_flags.automation_misuse_detected) violations.push("Automation Misuse");
                if (content_flags.self_harm_detected) violations.push("Self Harm");
                if (content_flags.extremist_content_detected) violations.push("Extremist Content");
                if (content_flags.child_safety_violation) violations.push("Child Safety");

                const userInfo = userMap.get(metric.user_id) || { username: "Unknown", email: "Unknown" };

                return {
                    id: metric.id,
                    tool: metric.prompt_type,
                    input: data ? (data as Record<string, any>)[inputColumn] || "N/A" : "N/A",
                    violations,
                    content_flags,
                    username: (() => {
                        const uname = userInfo.username;
                        const lastUnderscore = uname.lastIndexOf('_');
                        return lastUnderscore !== -1 ? uname.substring(0, lastUnderscore) : uname;
                    })(),
                    email: userInfo.email,
                    timestamp: metric.timestamp,
                    moderator_approval: metric.moderator_approval || 'not_requested',
                    moderator_notes: metric.moderator_notes,
                    user_requested_moderation: metric.user_requested_moderation || false,
                    status: metric.moderator_approval || 'not_requested'
                };
            })
        );

        const formattedViolations = results.filter(Boolean);
        return NextResponse.json({
            violations: formattedViolations,
            totalCount: count || 0,
            currentPage: page,
            pageSize: pageSize
        });
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
} 