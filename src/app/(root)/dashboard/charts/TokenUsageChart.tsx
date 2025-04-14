"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

export type AiToolsMetric = {
    timestamp: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
};

export type AreaChartProps = {
    aiToolsMetrics: AiToolsMetric[];
};

const chartConfig = {
    tokens: {
        label: "Tokens",
    },
    input: {
        label: "Input",
        color: "hsl(var(--chart-1))",
    },
    output: {
        label: "Output",
        color: "hsl(var(--chart-2))",
    },
    total: {
        label: "Total",
        color: "hsl(var(--chart-4))",
    },
} satisfies ChartConfig;

export function Component({ aiToolsMetrics }: AreaChartProps) {
    const formattedData = React.useMemo(() => {
        const dailyDataMap = new Map();

        aiToolsMetrics.forEach((metric) => {
            const date = new Date(metric.timestamp).toISOString().split("T")[0];

            if (!dailyDataMap.has(date)) {
                dailyDataMap.set(date, {
                    date,
                    input: 0,
                    output: 0,
                    total: 0,
                });
            }

            const dailyData = dailyDataMap.get(date);
            dailyData.input += metric.input_tokens;
            dailyData.output += metric.output_tokens;
            dailyData.total += metric.total_tokens;
        });

        return Array.from(dailyDataMap.values())
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [aiToolsMetrics]);

    return (
        <Card>
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                <div className="grid flex-1 gap-1 text-center sm:text-left">
                    <CardTitle>Token Usage Over Time</CardTitle>
                    <CardDescription>
                        Visualise token consumption patterns across input and output interactions
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                    <AreaChart data={formattedData}>
                        <defs>
                            <linearGradient id="fillInput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-input)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-input)" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="fillOutput" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-output)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-output)" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = new Date(value);
                                return date.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                });
                            }}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) => {
                                        return new Date(value).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        });
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey="output"
                            type="natural"
                            fill="url(#fillOutput)"
                            stroke="var(--color-output)"
                            stackId="a"
                        />
                        <Area
                            dataKey="input"
                            type="natural"
                            fill="url(#fillInput)"
                            stroke="var(--color-input)"
                            stackId="a"
                        />
                        <Area
                            dataKey="total"
                            type="natural"
                            fill="url(#fillTotal)"
                            stroke="var(--color-total)"
                            stackId="a"
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}