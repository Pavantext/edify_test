import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const dynamic = "force-dynamic";

interface SowGeneratorRecord {
  username: string;
  subject: string;
  topic: string;
  year_group: number;
  age_range: string;
  total_lessons: number;
  lesson_duration: number;
  emphasis_areas: string[];
  difficulty_level: string;
  sow_data: string;
  created_at: string;
}

interface SowGeneratorResponse {
  data: SowGeneratorRecord[];
  limit: number;
  offset: number;
  totalPages: number;
  totalRecords: number;
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    // Retrieve auth details.
    const { userId, orgId, orgRole } = await auth();

    // Parse pagination & search parameters.
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const search = url.searchParams.get("search") || "";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // By default, allowed IDs is just the current user.
    let userIdsToFetch: string[] = [userId];

    // If the user is an admin, fetch all user IDs in the organization
    // directly from the users table (assuming each user has an org_id field).
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
      const searchUserIds = searchUsers.map((u: any) => u.id);
      userIdsToFetch = userIdsToFetch.filter((id) =>
        searchUserIds.includes(id)
      );
    }

    // Get total record count.
    const { count, error: countError } = await supabase
      .from("sow_generator_results")
      .select("id", { count: "exact", head: true })
      .in("user_id", userIdsToFetch);
    if (countError) {
      console.error("Count error:", countError);
      return NextResponse.json(
        { error: "Failed to fetch total count" },
        { status: 500 }
      );
    }

    // Fetch the SOW generator records.
    const { data: results, error: resultsError } = await supabase
      .from("sow_generator_results")
      .select("*")
      .in("user_id", userIdsToFetch)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (resultsError) {
      console.error("Error fetching SOW generator results:", resultsError);
      return NextResponse.json(
        { error: "Failed to fetch SOW generator results" },
        { status: 500 }
      );
    }

    // Retrieve usernames from the users table.
    const uniqueUserIds = Array.from(new Set(results.map((r: any) => r.user_id)));
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
    const userMap = new Map(users.map((u: any) => [u.id, u.username]));

    // Format the data—combine age_range_start and age_range_end into a single field.
    const formattedData: SowGeneratorRecord[] = results.map((record: any) => ({
      username: userMap.get(record.user_id) || "Unknown",
      subject: record.subject,
      topic: record.topic,
      year_group: record.year_group,
      age_range: `${record.age_range_start} - ${record.age_range_end}`,
      total_lessons: record.total_lessons,
      lesson_duration: record.lesson_duration,
      emphasis_areas: record.emphasis_areas,
      difficulty_level: record.difficulty_level,
      sow_data: record.sow_data,
      created_at: record.created_at,
    }));

    const totalPages = Math.ceil((count as number) / limit);

    return NextResponse.json({
      data: formattedData,
      limit,
      offset,
      totalPages,
      totalRecords: count,
    } as SowGeneratorResponse);
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}