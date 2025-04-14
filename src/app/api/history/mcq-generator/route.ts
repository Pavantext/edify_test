import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

interface McqGeneratorRecord {
    username: string;
    topic: string;
    difficulty: string;
    total_questions: number;
    taxonomy_levels: string[];
    questions_data: string;
    created_at: string;
}

interface McqGeneratorResponse {
    data: McqGeneratorRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
    try {
        // Initialize Supabase client and authenticate the user.
        const supabase = await createClient();
        // Retrieve orgRole along with userId and orgId.
        const { userId, orgId, orgRole } = await auth();

        // Parse query parameters for pagination and search.
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const search = url.searchParams.get("search") || "";

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        // By default, non-admin users only see their own records.
        let userIdsToFetch: string[] = [userId];

        // If the user is an admin (using the role from auth), fetch all user IDs in the organization.
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
            userIdsToFetch = orgUsers.map((user) => user.user_id);
        }

        // Optionally filter by username if a search term is provided.
        if (search) {
            const { data: searchUsers, error: searchUsersError } = await supabase
                .from("users")
                .select("id")
                .ilike("username", `%${search}%`);
            if (searchUsersError) {
                console.error("Error searching for users:", searchUsersError);
                return NextResponse.json(
                    { error: "Failed to search for users" },
                    { status: 500 }
                );
            }
            const searchUserIds = searchUsers.map((u) => u.id);
            userIdsToFetch = userIdsToFetch.filter((id) => searchUserIds.includes(id));
        }

        // Get the total record count for pagination.
        const { count, error: countError } = await supabase
            .from("mcq_generator_results")
            .select("id", { count: "exact", head: true })
            .in("user_id", userIdsToFetch);
        if (countError) {
            console.error("Count error:", countError);
            return NextResponse.json(
                { error: "Failed to fetch total count" },
                { status: 500 }
            );
        }

        // Fetch the MCQ generator records.
        const { data: mcqResults, error: mcqResultsError } = await supabase
            .from("mcq_generator_results")
            .select("*")
            .in("user_id", userIdsToFetch)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (mcqResultsError) {
            console.error("Error fetching MCQ generator records:", mcqResultsError);
            return NextResponse.json(
                { error: "Failed to fetch MCQ generator records" },
                { status: 500 }
            );
        }

        // Fetch usernames from the users table.
        const uniqueUserIds = Array.from(new Set(mcqResults.map((record) => record.user_id)));
        const { data: users, error: usersError } = await supabase
            .from("users")
            .select("id, username")
            .in("id", uniqueUserIds);
        if (usersError) {
            console.error("Error fetching usernames:", usersError);
            return NextResponse.json(
                { error: "Failed to fetch usernames" },
                { status: 500 }
            );
        }
        const userMap = new Map(users.map((user) => [user.id, user.username]));

        // Format the data.
        const formattedData = mcqResults.map((record) => ({
            username: userMap.get(record.user_id) || "Unknown",
            topic: record.topic,
            difficulty: record.difficulty,
            total_questions: record.total_questions,
            taxonomy_levels: record.taxonomy_levels,
            questions_data: record.questions_data,
            created_at: record.created_at,
        }));

        const totalPages = Math.ceil((count as number) / limit);

        return NextResponse.json({
            data: formattedData,
            limit,
            offset,
            totalPages,
            totalRecords: count,
        } as McqGeneratorResponse);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}