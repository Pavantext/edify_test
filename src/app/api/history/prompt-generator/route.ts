import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const dynamic = "force-dynamic";

interface PromptGeneratorRecord {
    username: string;
    input_original_prompt: string;
    ai_refined_prompts: string;
    processing_time_ms: number;
    generation_model: string;
    created_at: string;
}

interface PromptGeneratorResponse {
    data: PromptGeneratorRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
    try {
        const supabase = await createClient();
        // Retrieve userId, orgId, and orgRole directly from auth.
        const { userId, orgId, orgRole } = await auth();

        // Parse query parameters for pagination and search.
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const search = url.searchParams.get("search") || "";

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized access" },
                { status: 401 }
            );
        }

        // By default, non-admin users (educators) see only their own data.
        let userIdsToFetch: string[] = [userId];

        // If the user is an admin, allow fetching all records from users in the organization.
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
        // Since the prompt table does not include the username, we join with the users table.
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
            // Intersect the allowed user IDs with those matching the search criteria.
            userIdsToFetch = userIdsToFetch.filter((id) =>
                searchUserIds.includes(id)
            );
        }

        // Get the total count of records for pagination.
        const { count, error: countError } = await supabase
            .from("prompt_generator_results")
            .select("id", { count: "exact", head: true })
            .in("user_id", userIdsToFetch);
        if (countError) {
            console.error("Count error:", countError);
            return NextResponse.json(
                { error: "Failed to fetch total count" },
                { status: 500 }
            );
        }

        // Fetch the prompt generator records.
        const { data: promptResults, error: promptResultsError } = await supabase
            .from("prompt_generator_results")
            .select("*")
            .in("user_id", userIdsToFetch)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (promptResultsError) {
            console.error("Error fetching prompt generator records:", promptResultsError);
            return NextResponse.json(
                { error: "Failed to fetch prompt generator records" },
                { status: 500 }
            );
        }

        // Fetch the usernames for the records (joining with the users table).
        const uniqueUserIds = Array.from(
            new Set(promptResults.map((record) => record.user_id))
        );
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

        // Format the data to be returned.
        const formattedData = promptResults.map((record) => ({
            username: userMap.get(record.user_id) || "Unknown",
            input_original_prompt: record.input_original_prompt,
            ai_refined_prompts: record.ai_refined_prompts,
            processing_time_ms: record.processing_time_ms,
            generation_model: record.generation_model,
            created_at: record.created_at,
        }));

        const totalPages = Math.ceil((count as number) / limit);

        return NextResponse.json({
            data: formattedData,
            limit,
            offset,
            totalPages,
            totalRecords: count,
        } as PromptGeneratorResponse);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}