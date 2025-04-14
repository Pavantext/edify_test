"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { CustomUser } from "../page";

interface BarChartProps {
    users: CustomUser[];
}

type KeysToSum = 'amd' | 'bd' | 'csv' | 'cv' | 'ecd' | 'fid' | 'md' | 'pid' | 'pii' | 'shd';

export function Component({ users }: BarChartProps) {
    const keysToSum: KeysToSum[] = ['amd', 'bd', 'csv', 'cv', 'ecd', 'fid', 'md', 'pid', 'pii', 'shd'];
    const sumSelectedValues = (arr: CustomUser[], keys: KeysToSum[]) => {
        return arr.reduce((sum, obj) => {
            keys.forEach(key => {
                sum += obj[key];
            });
            return sum;
        }, 0);
    };

    const chartData = users.map((user) => ({
        username: user.username,
        totalViolations: sumSelectedValues([user], keysToSum),
    }));

    const chartConfig = {
        totalViolations: {
            label: "Violations",
            color: "hsl(var(--chart-2))",
        },
        label: {
            color: "hsl(var(--background))",
        },
    } satisfies ChartConfig;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Violations per User</CardTitle>
                {/* <CardDescription>Users vs. tokens used</CardDescription> */}
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        layout="vertical"
                        margin={{
                            left: 16,
                        }}
                    >
                        <XAxis type="number" dataKey="totalViolations" />
                        <YAxis
                            dataKey="username"
                            type="category"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => value.slice(0, 3)}
                            hide
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent />}
                        />
                        <Bar
                            dataKey="totalViolations"
                            fill="var(--color-totalViolations)"
                            radius={5}
                        >
                            <LabelList
                                dataKey="username"
                                position="insideLeft"
                                offset={8}
                                className="fill-[--color-label]"
                                fontSize={12}
                            />
                        </Bar>
                    </BarChart>
                </ChartContainer>
            </CardContent>
            {/* <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none">
                    Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    Showing token usage per user
                </div>
            </CardFooter> */}
        </Card>
    );
}
