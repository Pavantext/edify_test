import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const dynamic = "force-dynamic";

interface LessonPlanRecord {
    username: string;
    input_topic: string;
    input_year_group: string;
    input_duration: number;
    input_subject: string;
    input_special_consideration: string;
    ai_lesson_plan: string;
    created_at: string;
}

interface LessonPlanResponse {
    data: LessonPlanRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
    try {
        // Initialize Supabase and get authentication details
        const supabase = await createClient();
        const { userId, orgId, orgRole } = await auth();

        // Parse query parameters for pagination and search
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const search = url.searchParams.get("search") || "";

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        // Fetch only the current user's records unless they are an admin
        let userIdsToFetch: string[] = [userId];

        if (orgId && orgRole === "org:admin") {
            const { data: orgUsers, error: orgUsersError } = await supabase
                .from("org_members")
                .select("user_id")
                .eq("org_id", orgId);

            if (orgUsersError) {
                console.error("Error fetching organization users:", orgUsersError);
                return NextResponse.json({ error: "Failed to fetch organization users" }, { status: 500 });
            }

            userIdsToFetch = orgUsers.map((user) => user.user_id);
        }

        // Filter by search term if provided
        if (search) {
            const { data: searchUsers, error: searchUsersError } = await supabase
                .from("users")
                .select("id")
                .ilike("username", `%${search}%`);

            if (searchUsersError) {
                console.error("Error searching for users:", searchUsersError);
                return NextResponse.json({ error: "Failed to search for users" }, { status: 500 });
            }

            const searchUserIds = searchUsers.map((u) => u.id);
            userIdsToFetch = userIdsToFetch.filter((id) => searchUserIds.includes(id));
        }

        // Get the total record count for pagination
        const { count, error: countError } = await supabase
            .from("lesson_plan_results")
            .select("id", { count: "exact", head: true })
            .in("user_id", userIdsToFetch);

        if (countError) {
            console.error("Error fetching total count:", countError);
            return NextResponse.json({ error: "Failed to fetch total count" }, { status: 500 });
        }

        // Fetch the lesson plan records
        const { data: lessonPlans, error: lessonPlansError } = await supabase
            .from("lesson_plan_results")
            .select("*")
            .in("user_id", userIdsToFetch)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (lessonPlansError) {
            console.error("Error fetching lesson plans:", lessonPlansError);
            return NextResponse.json({ error: "Failed to fetch lesson plans" }, { status: 500 });
        }

        // Fetch usernames from the users table
        const uniqueUserIds = Array.from(new Set(lessonPlans.map((record) => record.user_id)));
        const { data: users, error: usersError } = await supabase
            .from("users")
            .select("id, username")
            .in("id", uniqueUserIds);

        if (usersError) {
            console.error("Error fetching usernames:", usersError);
            return NextResponse.json({ error: "Failed to fetch usernames" }, { status: 500 });
        }

        // Map user_id to username
        const userMap = new Map(users.map((user) => [user.id, user.username]));

        // Format the data
        const formattedData: LessonPlanRecord[] = lessonPlans.map((record) => ({
            username: userMap.get(record.user_id) || "Unknown",
            input_topic: record.input_topic,
            input_year_group: record.input_year_group,
            input_duration: record.input_duration,
            input_subject: record.input_subject,
            input_special_consideration: record.input_special_consideration,
            ai_lesson_plan: record.ai_lesson_plan,
            created_at: record.created_at,
        }));

        const totalPages = Math.ceil((count as number) / limit);

        return NextResponse.json({
            data: formattedData,
            limit,
            offset,
            totalPages,
            totalRecords: count,
        } as LessonPlanResponse);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}