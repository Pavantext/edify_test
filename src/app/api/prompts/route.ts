import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
    try {
        const url = new URL(req.url);
        const fromDate = url.searchParams.get('from');
        const toDate = url.searchParams.get('to');

        const { userId, orgId, orgRole } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        const supabase = await createClient();

        let userIdsToFetch: string[] = [userId];
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

        let metricsQuery = supabase
            .from('ai_tools_metrics')
            .select('timestamp, prompt_type')
            .in('user_id', userIdsToFetch);

        if (fromDate) {
            metricsQuery = metricsQuery.gte('timestamp', `${fromDate}T00:00:00.000Z`);
        }

        if (toDate) {
            metricsQuery = metricsQuery.lte('timestamp', `${toDate}T23:59:59.999Z`);
        }

        const { data: metricsData, error: metricsError } = await metricsQuery;

        if (metricsError) {
            console.error("Error fetching prompt usage metrics:", metricsError);
            return NextResponse.json({ error: metricsError.message }, { status: 500 });
        }

        const dailyPromptCounts = metricsData.reduce((acc: any, record: any) => {
            const date = new Date(record.timestamp).toISOString().split('T')[0];

            if (!acc[date]) {
                acc[date] = { date, count: 0 };
            }

            acc[date].count += 1;
            return acc;
        }, {});

        const promptUsageData = Object.values(dailyPromptCounts).sort((a: any, b: any) =>
            a.date.localeCompare(b.date)
        );

        return NextResponse.json(promptUsageData);
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}