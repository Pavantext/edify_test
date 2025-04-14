"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
    Book,
    MessageSquare,
    ClipboardCheck,
    Brain,
    FileText,
    BookOpen,
} from "lucide-react";

const tools = [
    {
        title: "Lesson Planner",
        description:
            "Create comprehensive lesson plans with learning objectives and activities",
        icon: Book,
        href: "/history/lesson-plan-generator",
    },
    {
        title: "Prompt Generator",
        description: "Generate engaging educational prompts for discussions",
        icon: MessageSquare,
        href: "/history/prompt-generator",
    },
    {
        title: "Long Question Answer Generator",
        description: "Generate well-structured questions and answers.",
        icon: Brain,
        href: "/history/long-qa-generator",
    },
    // {
    //     title: "Research Paper Search",
    //     description: "Search for research papers on a specific topic.",
    //     icon: BookOpen,
    //     href: "/history/research-paper-search",
    // },
    {
        title: "Edify Chat",
        description: "View and manage your AI chat conversations",
        icon: MessageSquare,
        href: "/history/ai-chat-history",
        color: "text-blue-500",
        bgColor: "bg-blue-100",
    },
    {
        title: "PEEL Generator",
        description: "Generate well-structured paragraphs using the PEEL format",
        icon: Brain,
        href: "/history/peel-generator",
    },
    {
        title: "MCQ Generator",
        description:
            "Create multiple-choice questions with varying complexity levels",
        icon: MessageSquare,
        href: "/history/mcq-generator",
    },
    {
        title: "Report Generator",
        description: "Generate detailed student progress reports",
        icon: FileText,
        href: "/history/report-generator",
    },
    {
        title: "Clarify or Challenge",
        description: "Create customized quizzes with various question types",
        icon: MessageSquare,
        href: "/history/clarify-or-challenge",
    },
    {
        title: "Perspective Challenge",
        description: "Create customized quizzes with various question types",
        icon: MessageSquare,
        href: "/history/perspective-challenge",
    },
    {
        title: "Rubric Generator",
        description: "Create detailed assessment rubrics for any task",
        icon: ClipboardCheck,
        href: "/history/rubric-generator",
    },
    {
        title: "SOW Generator",
        description: "Create comprehensive schemes of work",
        icon: Book,
        href: "/history/sow-generator",
    },

    {
        title: "Quiz Generator",
        description: "Create customized quizzes with various question types",
        icon: MessageSquare,
        href: "/history/quiz-generator",
    },
];

export default function HistoryGrid() {
    return (
        <div className='max-w-6xl mx-auto px-4'>
            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
                {tools.map((tool) => (
                    <Link href={tool.href} key={tool.title}>
                        <Card className='transition-colors cursor-pointer hover:bg-gradient-to-b hover:from-[#64c5b7] hover:to-[#438b9d] hover:text-white group'>
                            <CardHeader>
                                <div className='flex items-center gap-2'>
                                    <tool.icon className='w-6 h-6 text-[#70CDB3] group-hover:text-white' />
                                    <CardTitle className='text-small'>{tool.title}</CardTitle>
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}