"use client";

import useSWR from "swr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Component as Cards } from "./charts/Cards";
import { CalendarDateRangePicker } from "./DatePickerWithRange";
import { Component as ToolsUsageChart } from "./charts/ToolsUsageChart";
import { Component as TokenUsageUserChart } from "./charts/TokenUsageUserChart";
import { Component as UserViolationsChart } from "./charts/UserViolationsChart";
import { Component as TokenUsageChart } from "./charts/TokenUsageChart";
import { Component as ViolationsChart } from "./charts/ViolationsChart";
import { DataTable as UsersTable } from "@/components/users/data-table";
import { Component as PromptUsageChart } from "./charts/PromptUsageChart";
import { ViolationsTable } from "@/components/violations/data-table";
import { columns } from "@/components/users/columns";
import { columns as ViolationColumns } from "@/components/violations/columns";
import { DashboardSkeleton } from "@/components/skeleton/DashboardSkeleton";
import { useState } from "react";
import { format } from "date-fns";

export type CustomUser = {
    id: string;
    username: string;
    name: string;
    email: string;
    role: string;
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
};

export type PromptUsageData = {
    date: string;
    count: number;
};

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch dashboard data");
    return res.json();
};

export default function Dashboard() {
    const [dateRange, setDateRange] = useState<{
        from: Date;
        to: Date;
    }>({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(),
    });

    const getDateQueryString = () => {
        if (!dateRange?.from || !dateRange?.to) return '';
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        return `?from=${fromDate}&to=${toDate}`;
    };

    const dashboardUrl = `/api/dashboard${getDateQueryString()}`;
    const violationsUrl = `/api/violations${getDateQueryString()}`;
    const promptUsageUrl = `/api/prompts${getDateQueryString()}`;

    const { data, error, isLoading } = useSWR(
        dashboardUrl,
        fetcher,
        {
            keepPreviousData: true,
            refreshInterval: 30000,
            revalidateOnFocus: true,
        }
    );

    const {
        data: violationsData,
        error: violationsError,
        isLoading: violationsLoading,
    } = useSWR(violationsUrl, fetcher, {
        keepPreviousData: true,
        refreshInterval: 30000,
        revalidateOnFocus: true,
    });

    const {
        data: promptUsageData,
        error: promptUsageError,
        isLoading: promptUsageLoading,
    } = useSWR<PromptUsageData[]>(promptUsageUrl, fetcher, {
        keepPreviousData: true,
        refreshInterval: 30000,
        revalidateOnFocus: true,
    });

    const users = data?.users || [];
    const aiToolsMetrics = data?.metricsData || [];
    const toolUsage = data?.toolUsage || {};
    const orgName = data?.organization?.name || null;
    const violations = violationsData || [];
    const prompts = promptUsageData || [];

    if (isLoading || violationsLoading || promptUsageLoading) return <DashboardSkeleton />;

    if (error || violationsError || promptUsageError) {
        return <div className="p-8 min-h-screen text-red-500">
            Error: {error?.message || violationsError?.message}
        </div>;
    }

    return (
        <div className="p-8 min-h-screen">
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-bold mb-8">
                    Dashboard {orgName ? `of ${orgName}` : ""}
                </h1>
                <CalendarDateRangePicker
                    className="mb-8"
                    dateRange={dateRange} setDateRange={setDateRange}
                />
            </div>
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="mb-8 sm:w-fit">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="violations">Violations</TabsTrigger>
                    {/* <TabsTrigger value="activity" disabled>
                        Activity
                    </TabsTrigger> */}
                </TabsList>

                <TabsContent value="overview">
                    <div className="mb-8">
                        <Cards users={users} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                        <ToolsUsageChart toolUsage={toolUsage} />
                        {/* <TokenUsageChart aiToolsMetrics={aiToolsMetrics} /> */}
                        <PromptUsageChart promptUsageData={prompts} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <ViolationsChart users={users} />
                        {/* <TokenUsageUserChart users={users} /> */}
                        <UserViolationsChart users={users} />
                    </div>
                </TabsContent>

                <TabsContent value="users">
                    <div className="h-full flex-1 flex-col space-y-8 md:flex">
                        <UsersTable data={users} columns={columns} />
                    </div>
                </TabsContent>

                <TabsContent value="violations">
                    <div className="h-full flex-1 flex-col space-y-8 md:flex">
                        <ViolationsTable data={violations} columns={ViolationColumns} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}