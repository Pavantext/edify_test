import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
    try {
        const url = new URL(req.url);
        const fromDate = url.searchParams.get('from');
        const toDate = url.searchParams.get('to');

        const { userId, orgId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
        }

        const clerk = await clerkClient();
        let organization = null;
        let formattedUsers = [];

        if (orgId) {
            organization = await clerk.organizations.getOrganization({
                organizationId: orgId,
            });
            const orgUsersMemberships = await clerk.organizations.getOrganizationMembershipList({
                organizationId: orgId,
            });

            formattedUsers = orgUsersMemberships.data.map((member) => ({
                id: member.publicUserData?.userId as string,
                email: member.publicUserData?.identifier || '',
                name: `${member.publicUserData?.firstName || ''} ${member.publicUserData?.lastName || ''}`,
                role: member.role.replace("org:", "") || 'user',
                noOfPrompts: 0,
                tokensUsed: 0,
                totalCost: 0,
                pii: 0,
                cv: 0,
                bd: 0,
                pid: 0,
                fid: 0,
                md: 0,
                shd: 0,
                ecd: 0,
                csv: 0,
                amd: 0,
                username: '',
            }));
        } else {
            formattedUsers = [{
                id: userId,
                email: '',
                name: '',
                role: 'user',
                noOfPrompts: 0,
                tokensUsed: 0,
                totalCost: 0,
                pii: 0,
                cv: 0,
                bd: 0,
                pid: 0,
                fid: 0,
                md: 0,
                shd: 0,
                ecd: 0,
                csv: 0,
                amd: 0,
                username: '',
            }];
        }

        const supabase = await createClient();
        const userIds = formattedUsers.map((user) => user.id);

        let metricsQuery = supabase
            .from('ai_tools_metrics')
            .select('*')
            .in('user_id', userIds);

        if (fromDate) {
            metricsQuery = metricsQuery.gte('timestamp', `${fromDate}T00:00:00.000Z`);
        }

        if (toDate) {
            metricsQuery = metricsQuery.lte('timestamp', `${toDate}T23:59:59.999Z`);
        }

        const { data: metricsData, error: metricsError } = await metricsQuery;

        const toolUsage: Record<string, number> = {};

        if (metricsError) {
            console.error("Error fetching metrics:", metricsError);
            return NextResponse.json({ error: metricsError.message }, { status: 500 });
        }

        if (metricsData) {
            const aggregatedMetrics: Record<
                string,
                {
                    noOfPrompts: number;
                    tokensUsed: number;
                    totalCost: number;
                    pii: number;
                    cv: number;
                    bd: number;
                    pid: number;
                    fid: number;
                    md: number;
                    shd: number;
                    ecd: number;
                    csv: number;
                    amd: number;
                }
            > = {};

            userIds.forEach((uid) => {
                aggregatedMetrics[uid] = {
                    noOfPrompts: 0,
                    tokensUsed: 0,
                    totalCost: 0,
                    pii: 0,
                    cv: 0,
                    bd: 0,
                    pid: 0,
                    fid: 0,
                    md: 0,
                    shd: 0,
                    ecd: 0,
                    csv: 0,
                    amd: 0,
                };
            });

            metricsData.forEach((record: any) => {
                const uid = record.user_id;
                if (!aggregatedMetrics[uid]) {
                    aggregatedMetrics[uid] = {
                        noOfPrompts: 0,
                        tokensUsed: 0,
                        totalCost: 0,
                        pii: 0,
                        cv: 0,
                        bd: 0,
                        pid: 0,
                        fid: 0,
                        md: 0,
                        shd: 0,
                        ecd: 0,
                        csv: 0,
                        amd: 0,
                    };
                }

                aggregatedMetrics[uid].noOfPrompts += 1;
                aggregatedMetrics[uid].tokensUsed += record.total_tokens || 0;
                aggregatedMetrics[uid].totalCost += record.price_gbp || 0;

                const flags = record.content_flags || {};
                aggregatedMetrics[uid].pii += flags.pii_detected ? 1 : 0;
                aggregatedMetrics[uid].bd += flags.bias_detected ? 1 : 0;
                aggregatedMetrics[uid].cv += flags.content_violation ? 1 : 0;
                aggregatedMetrics[uid].md += flags.misinformation_detected ? 1 : 0;
                aggregatedMetrics[uid].pid += flags.prompt_injection_detected ? 1 : 0;
                aggregatedMetrics[uid].fid += flags.fraudulent_intent_detected ? 1 : 0;
                aggregatedMetrics[uid].shd += flags.self_harm_detected ? 1 : 0;
                aggregatedMetrics[uid].ecd += flags.extremist_content_detected ? 1 : 0;
                aggregatedMetrics[uid].csv += flags.child_safety_violation ? 1 : 0;
                aggregatedMetrics[uid].amd += flags.automation_misuse_detected ? 1 : 0;

                const tool = record.prompt_type;
                if (tool) {
                    toolUsage[tool] = (toolUsage[tool] || 0) + 1;
                }
            });

            formattedUsers = formattedUsers.map((user) => {
                const metrics = aggregatedMetrics[user.id] || {
                    noOfPrompts: 0,
                    tokensUsed: 0,
                    totalCost: 0,
                    pii: 0,
                    cv: 0,
                    bd: 0,
                    pid: 0,
                    fid: 0,
                    md: 0,
                    shd: 0,
                    ecd: 0,
                    csv: 0,
                    amd: 0,
                };
                return {
                    ...user,
                    noOfPrompts: metrics.noOfPrompts,
                    tokensUsed: metrics.tokensUsed,
                    totalCost: metrics.totalCost,
                    pii: metrics.pii,
                    cv: metrics.cv,
                    bd: metrics.bd,
                    pid: metrics.pid,
                    fid: metrics.fid,
                    md: metrics.md,
                    shd: metrics.shd,
                    ecd: metrics.ecd,
                    csv: metrics.csv,
                    amd: metrics.amd,
                };
            });
        }

        const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, username")
            .in("id", userIds);

        if (usersError) {
            console.error("Error fetching usernames:", usersError);
        } else if (usersData) {
            const usernameMap = new Map(usersData.map((u: any) => [u.id, u.username]));
            formattedUsers = formattedUsers.map((user) => {
                let uname = usernameMap.get(user.id) || user.name;
                const lastUnderscore = uname.lastIndexOf('_');
                if (lastUnderscore !== -1) {
                    uname = uname.substring(0, lastUnderscore);
                }
                return {
                    ...user,
                    username: uname,
                };
            });
        }

        return NextResponse.json({
            users: formattedUsers,
            metricsData,
            toolUsage,
            organization: organization ? { name: organization.name } : null
        });
    } catch (error) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}