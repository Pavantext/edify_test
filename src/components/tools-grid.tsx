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
    href: "/tools/lesson-plan-generator",
  },
  {
    title: "Prompt Generator",
    description: "Generate engaging educational prompts for discussions",
    icon: MessageSquare,
    href: "/tools/prompt-generator",
  },
  {
    title: "Long Question Answer Generator",
    description: "Generate well-structured questions and answers.",
    icon: Brain,
    href: "/tools/long-qa-generator",
  },
  {
    title: "Research Paper Search",
    description: "Search for research papers on a specific topic.",
    icon: BookOpen,
    href: "/tools/research-paper-search",
  },

  {
    title: "Edify Chat",
    description: "View and manage your AI chat conversations",
    icon: MessageSquare,
    href: "/tools/ai-chat-history",
    color: "text-blue-500",
    bgColor: "bg-blue-100",
  },
  {
    title: "PEEL Generator",
    description: "Generate well-structured paragraphs using the PEEL format",
    icon: Brain,
    href: "/tools/peel-generator",
  },
  {
    title: "MCQ Generator",
    description:
      "Create multiple-choice questions with varying complexity levels",
    icon: MessageSquare,
    href: "/tools/mcq-generator",
  },
  {
    title: "Report Generator",
    description: "Generate detailed student progress reports",
    icon: FileText,
    href: "/tools/report-generator",
  },
  {
    title: "Clarify or Challenge",
    description:
      "Engage in critical thinking exercises by clarifying concepts or challenging ideas.",
    icon: MessageSquare,
    href: "/tools/clarify-or-challenge",
  },
  {
    title: "Perspective Challenge",
    description:
      "Test and expand your viewpoints with thought-provoking questions.",
    icon: MessageSquare,
    href: "/tools/perspective-challenge",
  },

  {
    title: "Rubric Generator",
    description: "Create detailed assessment rubrics for any task",
    icon: ClipboardCheck,
    href: "/tools/rubric-generator",
  },
  {
    title: "SOW Generator",
    description: "Create comprehensive schemes of work",
    icon: Book,
    href: "/tools/sow-generator",
  },

  {
    title: "Quiz Generator",
    description: "Create customised quizzes with various question types",
    icon: MessageSquare,
    href: "/tools/quiz-generator",
  },
  {
    title: "Lesson Plan Evaluator",
    description: "Evaluate and refine lesson plans for effectiveness",
    icon: ClipboardCheck,
    href: "/tools/lesson-plan-evaluator",
  },
];

const disabledTools: any[] = [];

export default function ToolsGrid() {
  return (
    <div className='max-w-6xl mx-auto px-4'>
      <div className='text-center mb-12'>
        <h1 className='text-5xl font-bold text-[#70CDB3] mb-4'>Our AI Tools</h1>
        <p className='text-muted-foreground max-w-3xl mx-auto'>
          These tools are crafted to inspire and nurture critical thinking,
          serving as a companion to both teaching and learning. They're here to
          present thoughtful options, prompting deeper reflection and
          exploration.
        </p>
      </div>
      <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4'>
        {tools.map((tool) => (
          <Link href={tool.href} key={tool.title}>
            <Card className='h-full transition-colors cursor-pointer hover:bg-gradient-to-b hover:from-[#64c5b7] hover:to-[#438b9d] hover:text-white group'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <tool.icon className='w-6 h-6 text-[#70CDB3] group-hover:text-white' style={{flexShrink: 0}} />
                  <CardTitle className='text-lg break-words'>{tool.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className='group-hover:text-white'>
                  {tool.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
        {disabledTools.map((tool) => (
          <div key={tool.title}>
            <Card className='h-full opacity-50 cursor-not-allowed'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <tool.icon className='w-6 h-6 text-[#70CDB3]' />
                  <CardTitle className='text-lg'>{tool.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{tool.description}</CardDescription>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
