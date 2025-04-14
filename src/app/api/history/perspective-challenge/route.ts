import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const dynamic = "force-dynamic";

interface PerspectiveChallengeRecord {
    username: string;
    input: string;
    analysis: string;
    created_at: string;
}

interface PerspectiveChallengeResponse {
    data: PerspectiveChallengeRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
    try {
        // Create Supabase client and authenticate user.
        const supabase = await createClient();
        // Retrieve orgRole along with userId and orgId.
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

        // If the user is an admin (using orgRole from auth), fetch all user IDs in the organization.
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

        // Optionally filter by username.
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

        // Get total record count.
        const { count, error: countError } = await supabase
            .from("perspective_challenge_results")
            .select("id", { count: "exact", head: true })
            .in("user_id", userIdsToFetch);
        if (countError) {
            console.error("Count error:", countError);
            return NextResponse.json(
                { error: "Failed to fetch total count" },
                { status: 500 }
            );
        }

        // Fetch the perspective challenge records.
        const { data: records, error: recordsError } = await supabase
            .from("perspective_challenge_results")
            .select("*")
            .in("user_id", userIdsToFetch)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
        if (recordsError) {
            console.error("Error fetching records:", recordsError);
            return NextResponse.json(
                { error: "Failed to fetch perspective challenge records" },
                { status: 500 }
            );
        }

        // Retrieve usernames from the users table.
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

        // Format the fetched data.
        const formattedData = records.map((record: any) => ({
            username: userMap.get(record.user_id) || "Unknown",
            input: record.input,
            analysis: record.analysis,
            created_at: record.created_at,
        }));

        const totalPages = Math.ceil((count as number) / limit);

        return NextResponse.json({
            data: formattedData,
            limit,
            offset,
            totalPages,
            totalRecords: count,
        } as PerspectiveChallengeResponse);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}