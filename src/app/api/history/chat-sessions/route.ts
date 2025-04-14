import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const dynamic = "force-dynamic";

interface ChatSessionRecord {
    username: string;
    title: string;
    messages: string;
    model: string;
    created_at: string;
}

interface ChatSessionResponse {
    data: ChatSessionRecord[];
    limit: number;
    offset: number;
    totalPages: number;
    totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
    try {
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

        // By default, only fetch records for the current user.
        let userIdsToFetch: string[] = [userId];

        // If the user is an admin, fetch records for all users in the organization.
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

        // (Optional) If a search term is provided, filter the allowed user IDs by matching usernames.
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
            .from("chat_sessions")
            .select("id", { count: "exact", head: true })
            .in("user_id", userIdsToFetch);

        if (countError) {
            console.error("Count error:", countError);
            return NextResponse.json(
                { error: "Failed to fetch total count" },
                { status: 500 }
            );
        }

        // Fetch the chat session records.
        const { data: chatSessions, error: chatSessionsError } = await supabase
            .from("chat_sessions")
            .select("*")
            .in("user_id", userIdsToFetch)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (chatSessionsError) {
            console.error("Error fetching chat sessions:", chatSessionsError);
            return NextResponse.json(
                { error: "Failed to fetch chat sessions" },
                { status: 500 }
            );
        }

        // Fetch usernames from the users table.
        const uniqueUserIds = Array.from(new Set(chatSessions.map((record) => record.user_id)));
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

        // Map user_id to username.
        const userMap = new Map(users.map((user) => [user.id, user.username]));

        // Format the data.
        const formattedData = chatSessions.map((record) => ({
            username: userMap.get(record.user_id) || "Unknown",
            title: record.title,
            messages: record.messages,
            model: record.model,
            created_at: record.created_at,
        }));

        const totalPages = Math.ceil((count as number) / limit);

        return NextResponse.json({
            data: formattedData,
            limit,
            offset,
            totalPages,
            totalRecords: count,
        } as ChatSessionResponse);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}