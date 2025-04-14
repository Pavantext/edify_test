import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export interface SOWResult {
  id: string;
  topic: string;
  subject: string;
  year_group: number;
  lessons: Lesson[];
  metadata: {
    author: string;
    version: string;
    createdAt: string;
  };
  overarchingObjectives?: string[];
  sow_data: SOWData;
}

export interface Lesson {
  title: string;
  duration: number;
  lessonNumber: number;
  activities: Activity[];
  learningObjectives: string[];
  stretchTasks: string[];
  scaffoldingStrategies: string[];
  crossCurricularLinks: string[];
  reflectionPrompts: string[];
  assessment: string[];
  differentiation: {
    core: string[];
    support: string[];
    extension: string[];
  };
}

interface Activity {
  title: string;
  duration: number;
  description: string;
  resources: string[];
}

interface SOWData {
  "data": {
    "topic": "string",
    "lessons": [
      {
        "title": "string",
        "duration": "number",
        "activities": [
          {
            "title": "string",
            "duration": "number",
            "resources": [
              "string"
            ],
            "description": "string"
          }
        ],
        "assessment": [
          "string"
        ],
        "lessonNumber": "number",
        "stretchTasks": [
          "string"
        ],
        "differentiation": {
          "core": [
            "string"
          ],
          "support": [
            "string"
          ],
          "extension": [
            "string"
          ]
        },
        "reflectionPrompts": [
          "string"
        ],
        "learningObjectives": [
          "string"
        ],
        "crossCurricularLinks": [
          "string"
        ],
        "scaffoldingStrategies": [
          "string"
        ]
      }
    ],
    "subject": "string",
    "ageGroup": {
      "year": "number"
    },
    "metadata": {
      "author": "string",
      "version": "string",
      "createdAt": "string"
    },
    "overarchingObjectives": [
      "string"
    ]
  }
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const supabase = await createClient();
    const { query } = await req.json();

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

    const { data, error } = await supabase
      .from("sow_generator_results")
      .select(`
        id,
        created_at,
        sow_data,
        topic,
        subject,
        year_group
      `)
      .or(`topic.ilike.%${query}%,sow_data->>topic.ilike.%${query}%`)
      .in("user_id", userIdsToFetch)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[SOW_SEARCH_ERROR]", error);
      return NextResponse.json(
        { error: "SOW search failed" },
        { status: 500 }
      );
    }

    const transformedResults = data?.map(item => ({
      id: item.id,
      type: 'sow' as const,
      created_at: item.created_at,
      sow_data: item.sow_data as SOWResult,
      topic: item.topic || (item.sow_data as SOWResult).topic,
      subject: item.subject || (item.sow_data as SOWResult).subject,
      year_group: item.year_group || (item.sow_data as SOWResult).year_group
    })) || [];

    return NextResponse.json({ results: transformedResults });
  } catch (error) {
    console.error("[SOW_SEARCH_CRITICAL]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
