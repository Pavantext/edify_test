"use client";

import { Pie, PieChart } from "recharts";
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
import { CustomUser } from "../page";

const getCategoryCount = (users: CustomUser[]) => {
    const categoryCount = {
        "PII Detected": 0,
        "Bias Detected": 0,
        "Content Violation": 0,
        "Misinformation Detected": 0,
        "Prompt Injection": 0,
        "Fraudulent Intent": 0,
        "Self Harm": 0,
        "Extremist Content": 0,
        "Child Safety Violation": 0,
        "Automation Misuse": 0,
    };

    users.forEach(user => {
        if (user.pii) categoryCount["PII Detected"] += user.pii;
        if (user.bd) categoryCount["Bias Detected"] += user.bd;
        if (user.cv) categoryCount["Content Violation"] += user.cv;
        if (user.md) categoryCount["Misinformation Detected"] += user.md;
        if (user.pid) categoryCount["Prompt Injection"] += user.pid;
        if (user.fid) categoryCount["Fraudulent Intent"] += user.fid;
        if (user.shd) categoryCount["Self Harm"] += user.shd;
        if (user.ecd) categoryCount["Extremist Content"] += user.ecd;
        if (user.csv) categoryCount["Child Safety Violation"] += user.csv;
        if (user.amd) categoryCount["Automation Misuse"] += user.amd;
    });

    return categoryCount;
};

export function Component({ users }: { users: CustomUser[]; }) {
    const categoryCount = getCategoryCount(users);

    const chartData = [
        { category: "PII Detected", count: categoryCount["PII Detected"], fill: "hsl(var(--chart-1))" },
        { category: "Bias Detected", count: categoryCount["Bias Detected"], fill: "hsl(var(--chart-2))" },
        { category: "Content Violation", count: categoryCount["Content Violation"], fill: "hsl(var(--chart-3))" },
        { category: "Misinformation Detected", count: categoryCount["Misinformation Detected"], fill: "hsl(var(--chart-4))" },
        { category: "Prompt Injection", count: categoryCount["Prompt Injection"], fill: "hsl(var(--chart-5))" },
        { category: "Fraudulent Intent", count: categoryCount["Fraudulent Intent"], fill: "hsl(198.4 93.2% 59.6%)" },
        { category: "Self Harm", count: categoryCount["Self Harm"], fill: "hsl(272.9 67.2% 39.4%)" },
        { category: "Extremist Content", count: categoryCount["Extremist Content"], fill: "hsl(24 9.8% 10%)" },
        { category: "Child Safety Violation", count: categoryCount["Child Safety Violation"], fill: "hsl(85.9 78.4% 27.3%)" },
        { category: "Automation Misuse", count: categoryCount["Automation Misuse"], fill: "hsl(0 72.2% 50.6%)" },
    ];

    const chartConfig = {
        count: {
            label: "Count",
        },
        ...Object.fromEntries(
            chartData.map((item, index) => [
                item.category,
                { label: item.category, color: item.fill },
            ])
        ),
    } satisfies ChartConfig;

    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle>Violation Distribution</CardTitle>
                <CardDescription>
                    Distribution of violations across all flags
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto max-h-[300px] [&_.recharts-text]:fill-background"
                >
                    <PieChart>
                        <ChartTooltip
                            content={<ChartTooltipContent nameKey="category" hideLabel />}
                        />
                        <Pie data={chartData} dataKey="count" nameKey="category" />
                        <ChartLegend
                            content={<ChartLegendContent nameKey="category" />}
                            className="hidden sm:flex -translate-y-2 flex-wrap gap-2"
                        />
                    </PieChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
