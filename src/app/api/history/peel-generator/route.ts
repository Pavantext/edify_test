import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const dynamic = "force-dynamic";

interface PeelGeneratorRecord {
    username: string;
    topic: string;
    subject: string;
    complexity: string;
    peel_content: string;
    tone: string;
    audience: string;
    word_count_range: string;
    feedback: string;
    created_at: string;
}

interface PeelGeneratorResponse {
    data: PeelGeneratorRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
    try {
        const supabase = await createClient();
        // Retrieve userId, orgId, and orgRole from auth.
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

        // By default, non-admin users see only their own records.
        let userIdsToFetch: string[] = [userId];

        // If the user is an admin (using orgRole from auth), allow fetching records for all users in the organization.
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
            userIdsToFetch = userIdsToFetch.filter((id) =>
                searchUserIds.includes(id)
            );
        }

        // Get the total count of records (for pagination).
        const { count, error: countError } = await supabase
            .from("peel_generator_results")
            .select("id", { count: "exact", head: true })
            .in("user_id", userIdsToFetch);

        if (countError) {
            console.error("Count error:", countError);
            return NextResponse.json(
                { error: "Failed to fetch total count" },
                { status: 500 }
            );
        }

        // Fetch the records from the peel_generator_results table.
        const { data: peelResults, error: peelResultsError } = await supabase
            .from("peel_generator_results")
            .select("*")
            .in("user_id", userIdsToFetch)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (peelResultsError) {
            console.error("Error fetching peel generator records:", peelResultsError);
            return NextResponse.json(
                { error: "Failed to fetch peel generator records" },
                { status: 500 }
            );
        }

        // Fetch the usernames for the records.
        const uniqueUserIds = Array.from(
            new Set(peelResults.map((record) => record.user_id))
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

        // Map each user_id to a username.
        const userMap = new Map(users.map((user) => [user.id, user.username]));

        // Format the data to return.
        const formattedData = peelResults.map((record) => ({
            username: userMap.get(record.user_id) || "Unknown",
            topic: record.topic,
            subject: record.subject,
            complexity: record.complexity,
            peel_content: record.peel_content,
            tone: record.tone,
            audience: record.audience,
            word_count_range: record.word_count_range,
            feedback: record.feedback,
            created_at: record.created_at,
        }));

        const totalPages = Math.ceil((count as number) / limit);

        return NextResponse.json({
            data: formattedData,
            limit,
            offset,
            totalPages,
            totalRecords: count,
        } as PeelGeneratorResponse);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}