import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const dynamic = "force-dynamic";

interface ClarifyOrChallengeRecord {
    username: string;
    type: string;
    input_text: string;
    output_text: string;
    created_at: string;
}

interface ClarifyOrChallengeResponse {
    data: ClarifyOrChallengeRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
    try {
        // Initialize Supabase and check authentication.
        const supabase = await createClient();
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

        // Use orgRole directly to determine if the user is an admin.
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

        // If a search term is provided, filter allowed user IDs by username.
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

        // Get the total record count for pagination.
        const { count, error: countError } = await supabase
            .from("clarify_or_challenge")
            .select("id", { count: "exact", head: true })
            .in("user_id", userIdsToFetch);
        if (countError) {
            console.error("Count error:", countError);
            return NextResponse.json(
                { error: "Failed to fetch total count" },
                { status: 500 }
            );
        }

        // Fetch the records from the "clarify_or_challenge" table.
        const { data: records, error: recordsError } = await supabase
            .from("clarify_or_challenge")
            .select("*")
            .in("user_id", userIdsToFetch)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (recordsError) {
            console.error("Error fetching records:", recordsError);
            return NextResponse.json(
                { error: "Failed to fetch clarify or challenge records" },
                { status: 500 }
            );
        }

        // Retrieve usernames from the "users" table.
        const uniqueUserIds = Array.from(new Set(records.map((r: any) => r.user_id)));
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
        const userMap = new Map(users.map((user: any) => [user.id, user.username]));

        // Format the data to return.
        const formattedData: ClarifyOrChallengeRecord[] = records.map((record: any) => ({
            username: userMap.get(record.user_id) || "Unknown",
            type: record.type,
            input_text: record.input_text,
            output_text: record.output_text,
            created_at: record.created_at,
        }));

        const totalPages = Math.ceil((count as number) / limit);

        return NextResponse.json({
            data: formattedData,
            limit,
            offset,
            totalPages,
            totalRecords: count,
        } as ClarifyOrChallengeResponse);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}