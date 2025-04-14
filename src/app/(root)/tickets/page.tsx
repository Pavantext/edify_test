"use client";
import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { format } from "date-fns";
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lessonPlanSchema } from "@/schemas/lesson-plan-schema";
import { MCQGeneratorSchema } from "@/schemas/mcq-schema";
import { PEELSchema } from "@/schemas/peel-schema";
import { PromptGeneratorResponseSchema } from "@/schemas/prompt-schema";
import { QuizSchema } from "@/schemas/quiz-schema";
import { reportGeneratorSchema } from "@/schemas/report-generator-schema";
import { RubricResponseSchema } from "@/schemas/rubric-schema";
import { SOWSchema } from "@/schemas/sow-schema";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  attachments: string[] | null;
  result_id: string | null;
  tool_type: string | null;
  user_id: string;  // This will be Clerk's user ID
}

interface ToolResult {
  id: string;
  [key: string]: any; // For other fields that vary by tool
}

const TicketUserInfo = ({ userId }: { userId: string }) => {
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    async function fetchUser() {
      try {
        // Add delay between requests
        timeoutId = setTimeout(async () => {
          const response = await fetch(`/api/users/${userId}`, {
            signal: controller.signal
          });
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          }
        }, 300); // 300ms delay
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error fetching user:', error);
        }
      }
    }
    
    if (userId) {
      fetchUser();
    }

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [userId]);

  if (!user) return <div className="animate-pulse h-10 w-40 bg-gray-200 rounded"></div>;
  
  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.imageUrl} />
        <AvatarFallback>
          {user.firstName?.[0]}{user.lastName?.[0]}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-0.5">
        <p className="text-sm">
          {[user.firstName, user.lastName].filter(Boolean).join(' ')}
        </p>
        {user.username && (
          <p className="text-sm text-gray-500">
            @{user.username}
          </p>
        )}
      </div>
    </div>
  );
};

const getToolTypeDisplay = (toolType: string | null) => {
  if (!toolType) return null;
  
  // Format the tool type for display
  const formattedType = toolType
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <Badge variant="secondary" className="capitalize">
      {formattedType}
    </Badge>
  );
};

const formatLessonPlanContent = (content: any) => {
  try {
    const plan = typeof content === 'string' ? JSON.parse(content) : content;
    
    return {
      "Basic Information": {
        "Subject": plan.subject,
        "Topic": plan.topic,
        "Year Group": plan.yearGroup,
        "Duration": `${plan.duration} minutes`
      },
      "Learning Objectives": plan.learningObjectives
        .map((obj: string, i: number) => `${i + 1}. ${obj}`)
        .join('\n'),
      "Initial Discussion Prompts": plan.initialPrompts
        .map((prompt: string, i: number) => `${i + 1}. ${prompt}`)
        .join('\n'),
      "Lesson Options": plan.lessonOptions
        .map((option: any, i: number) => formatLessonOption(option, i))
        .join('\n\n'),
      "Reflection Prompts": plan.reflectionPrompts
        .map((prompt: string, i: number) => `${i + 1}. ${prompt}`)
        .join('\n'),
      "Differentiation Support": formatDifferentiationSupport(plan.differentiationSupport),
      "Assessment Questions": formatAssessmentQuestions(plan.assessmentQuestions),
      "Additional Notes": plan.additionalNotes
        .map((note: string) => `• ${note}`)
        .join('\n')
    };
  } catch (error) {
    console.error('Error formatting lesson plan:', error);
    return String(content);
  }
};

// Helper functions for formatting specific sections
const formatLessonOption = (option: any, index: number) => `
Option ${index + 1}: ${option.title}

Starter Activity:
• Description: ${option.starterActivity.description}
• Duration: ${option.starterActivity.duration} minutes
• Materials: ${option.starterActivity.materials.join(', ')}

Main Activities:
${option.mainActivities.map((activity: any, i: number) => `
${i + 1}. ${activity.description}
   • Duration: ${activity.duration} minutes
   • Grouping: ${activity.grouping}
   • Materials: ${activity.materials.join(', ')}`).join('\n')}

Plenary:
• ${option.plenary.description}
• Duration: ${option.plenary.duration} minutes`;

const formatDifferentiationSupport = (support: any) => `
Visual Aids:
${support.visualAids.map((aid: string) => `• ${aid}`).join('\n')}

Sentence Starters:
${support.sentenceStarters.map((starter: string) => `• ${starter}`).join('\n')}

Group Roles:
${support.groupRoles.map((role: string) => `• ${role}`).join('\n')}

Multisensory Resources:
${support.multisensoryResources.map((resource: string) => `• ${resource}`).join('\n')}`;

const formatAssessmentQuestions = (questions: any[]) => 
  questions.map((q: any, i: number) => `
Question ${i + 1}:
• Level: ${q.level}
• Question: ${q.question}
• Example Answer: ${q.exampleAnswer}`).join('\n');

export default function TicketsDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<any>(null);
  const supabase = createClient();
  const isSupport = user?.publicMetadata?.role === 'support';

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tickets');
      
      if (response.status === 401) {
        router.push('/sign-in');
        return;
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch tickets');
      }

      console.log('Fetched tickets:', result.data);
      setTickets(result.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileType = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    }
    return 'document';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getStatusColor = (status: string) => {
    return status === 'open' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-gray-100 text-gray-800';
  };

  const updateTicketStatus = async (ticketId: string, status: 'open' | 'closed') => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        fetchTickets(); // Refresh tickets after update
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const updateTicketPriority = async (ticketId: string, priority: 'low' | 'medium' | 'high' | 'critical') => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });
      
      if (response.ok) {
        fetchTickets(); // Refresh tickets after update
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  };

  const fetchToolResult = async (resultId: string, toolType: string | null) => {
    if (!resultId || !toolType) return null;
    
    try {
      // Clean and normalize the tool type string
      let cleanToolType = toolType.toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '-');
      
      // Add -generator suffix if missing
      if (!cleanToolType.endsWith('-generator') && cleanToolType !== 'lesson-plan') {
        cleanToolType = `${cleanToolType}-generator`;
      }

      console.log('Tool type after cleaning:', cleanToolType);

      // Map tool types to their correct table names
      const tableNameMap: { [key: string]: string } = {
        'prompt-generator': 'prompt_generator_results',
        'lesson-plan': 'lesson_plan_results',
        'long-qa-generator': 'long_qa_generator_results',
        'mcq-generator': 'mcq_generator_results',
        'peel-generator': 'peel_generator_results',
        'report-generator': 'report_generator_results',
        'rubrics-generator': 'rubrics_generator_results'
      };

      const tableName = tableNameMap[cleanToolType];
      if (!tableName) {
        console.error(`Unknown tool type: "${cleanToolType}" Available types:`, Object.keys(tableNameMap));
        return null;
      }

      console.log('Fetching from table:', tableName, 'with id:', resultId);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', resultId)
        .single();

      if (error) {
        console.error('Supabase error:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching tool result:', error);
      return null;
    }
  };

  const handleViewResponse = async (resultId: string, toolType: string | null) => {
    const result = await fetchToolResult(resultId, toolType);
    setSelectedResponse(result);
  };

  const formatResponseData = (data: any, toolType: string | null): React.ReactNode => {
    if (!data || !toolType) return <div>No data available</div>;

    try {
      // Clean and normalize the tool type string
      const cleanToolType = toolType.toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '-');
      
      console.log('Tool type:', cleanToolType);
      console.log('Response data:', data);

      switch (cleanToolType) {
        case 'prompt-generator':
        case 'prompt': {
          console.log('Matched prompt generator case');
          const promptData = Array.isArray(data) ? data[0] : data;
          return (
            <Card className='p-8 shadow-lg'>
              <div className='space-y-8'>
                <div className='bg-white p-6 rounded-lg border border-gray-100'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                    Original Prompt
                  </h3>
                  <p className='text-gray-700'>{promptData.input_original_prompt}</p>
                </div>

                {promptData.ai_refined_prompts.map((refinedPrompt: any, index: number) => (
                  <div
                    key={index}
                    className='bg-white p-6 rounded-lg border border-gray-100'
                  >
                    <div className='flex justify-between items-center mb-4'>
                      <h3 className='text-lg font-semibold'>
                        Refined Version {index + 1}
                      </h3>
                      <div className='flex items-center space-x-2'>
                        <span className='px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'>
                          Refined Level:{" "}
                          {refinedPrompt.explanation.complexityLevel.refinedLevel}
                        </span>
                        <span className='px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full'>
                          {refinedPrompt.explanation.complexityLevel.bloomsLevel}
                        </span>
                      </div>
                    </div>

                    <div className='prose prose-sm max-w-none'>
                      <p className='text-gray-800'>{refinedPrompt.promptText}</p>
                      <div className='mt-4 space-y-2'>
                        <h4 className='font-medium text-gray-900'>Explanation</h4>
                        <p className='text-gray-700'>
                          {refinedPrompt.explanation.explanation}
                        </p>
                      </div>
                      <div className='mt-4'>
                        <h4 className='font-medium text-gray-900'>Focus Areas</h4>
                        <ul className='list-disc pl-5 space-y-1'>
                          {refinedPrompt.explanation.focusAreas.map(
                            (area: string, i: number) => (
                              <li key={i} className='text-gray-700'>
                                {area}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}

                <div className='text-sm text-gray-500'>
                  Generated in {promptData.processing_time_ms}ms • 
                  Model: {promptData.generation_model}
                </div>
              </div>
            </Card>
          );
        }

        default: {
          console.log('No matching tool type found:', cleanToolType);
          return <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
        }
      }
    } catch (error) {
      console.error('Error in formatResponseData:', error);
      return <div className="text-red-500">Error formatting response: {String(error)}</div>;
    }
  };

  const formatLessonPlanData = (lessonPlan: any): React.ReactNode => {
    if (!lessonPlan) return <div>No lesson plan data available</div>;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2">Lesson Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>Subject: {lessonPlan?.subject || 'Not specified'}</div>
            <div>Topic: {lessonPlan?.topic || 'Not specified'}</div>
            <div>Year Group: {lessonPlan?.yearGroup || 'Not specified'}</div>
            <div>Duration: {lessonPlan?.duration ? `${lessonPlan.duration} minutes` : 'Not specified'}</div>
          </div>
        </div>
        {/* Add similar sections for other data */}
      </div>
    );
  };

  if (!isLoaded || !user) {
    return null; // or a loading spinner
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='container mx-auto px-4 py-12'>
        {/* Header Section */}
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>Support Tickets</h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            View and manage your support requests and tool-generated responses
          </p>
        </div>

        {/* Filters Section - Only for Support Users */}
        {isSupport && (
          <div className='max-w-7xl mx-auto mb-8'>
            <Card className='p-6'>
              <div className='flex flex-col sm:flex-row gap-4'>
                <Select onValueChange={(value) => {/* Add filter logic */}}>
                  <SelectTrigger className='w-full sm:w-[180px]'>
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tickets</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(value) => {/* Add filter logic */}}>
                  <SelectTrigger className='w-full sm:w-[180px]'>
                    <SelectValue placeholder="Filter by Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </div>
        )}

        {/* Tickets List */}
        <div className='max-w-7xl mx-auto'>
          {loading ? (
            <div className='space-y-4'>
              {[1, 2, 3].map((n) => (
                <Card key={n} className='p-8'>
                  <div className='animate-pulse space-y-4'>
                    <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                    <div className='h-4 bg-gray-200 rounded w-full'></div>
                    <div className='h-4 bg-gray-200 rounded w-5/6'></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className='space-y-4'>
              {tickets.map((ticket) => (
                <Card key={ticket.id} className='shadow-lg'>
                  <div className='p-6'>
                    <div className='flex flex-col gap-4'>
                      {/* User Info and Title */}
                      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                        <TicketUserInfo userId={ticket.user_id} />
                        <h3 className='text-lg font-semibold'>{ticket.title}</h3>
                      </div>

                      {/* Badges and Controls */}
                      <div className='flex flex-wrap items-center gap-4'>
                        {isSupport ? (
                          <>
                            <div className='flex flex-wrap gap-2'>
                              <Select
                                defaultValue={ticket.priority}
                                onValueChange={(value) => updateTicketPriority(ticket.id, value as any)}
                              >
                                <SelectTrigger className='w-[120px]'>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                defaultValue={ticket.status}
                                onValueChange={(value) => updateTicketStatus(ticket.id, value as any)}
                              >
                                <SelectTrigger className='w-[120px]'>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        ) : (
                          <div className='flex gap-2'>
                            <Badge className={getPriorityColor(ticket.priority)}>
                              {ticket.priority}
                            </Badge>
                            <Badge className={getStatusColor(ticket.status)}>
                              {ticket.status}
                            </Badge>
                          </div>
                        )}
                        <div className='flex gap-2 items-center ml-auto'>
                          {ticket.tool_type && getToolTypeDisplay(ticket.tool_type)}
                          {ticket.attachments && (
                            <Badge variant="outline">
                              <Paperclip className="h-3 w-3 mr-1" />
                              {ticket.attachments.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ticket Details Accordion */}
                  <Accordion type="single" collapsible>
                    <AccordionItem value={ticket.id}>
                      <AccordionTrigger className='px-6 py-2 hover:no-underline'>
                        View Details
                      </AccordionTrigger>
                      <AccordionContent className='px-6 py-4'>
                        <div className='space-y-6'>
                          {/* Description */}
                          <div>
                            <h4 className='font-medium mb-2'>Description</h4>
                            <p className='text-gray-700 whitespace-pre-wrap'>
                              {ticket.description}
                            </p>
                          </div>

                          {/* Attachments */}
                          {ticket.attachments && ticket.attachments.length > 0 && (
                            <div>
                              <h4 className='font-medium mb-4'>Attachments</h4>
                              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                                {ticket.attachments.map((url, index) => (
                                  <div key={index} className='relative'>
                                    {getFileType(url) === 'image' ? (
                                      <a 
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className='block relative h-48 rounded-lg overflow-hidden border hover:opacity-90'
                                      >
                                        <img
                                          src={url}
                                          alt={`Attachment ${index + 1}`}
                                          className='w-full h-full object-cover'
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className='flex items-center p-4 border rounded-lg hover:bg-gray-50'
                                      >
                                        <FileText className="h-6 w-6 mr-2" />
                                        <span>View Document</span>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Response Details */}
                          {ticket.result_id && (
                            <div>
                              <h4 className='font-medium mb-4'>Response Details</h4>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline"
                                    onClick={() => handleViewResponse(ticket.result_id!, ticket.tool_type)}
                                  >
                                    View Response
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className='max-w-4xl max-h-[80vh] overflow-y-auto'>
                                  <DialogHeader>
                                    <DialogTitle>
                                      {ticket.tool_type && getToolTypeDisplay(ticket.tool_type)} Response
                                    </DialogTitle>
                                  </DialogHeader>
                                  {selectedResponse && (
                                    <div className='space-y-6'>
                                      {formatResponseData(selectedResponse, ticket.tool_type)}
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                            </div>
                          )}

                          {/* Created Date */}
                          <div className='text-sm text-gray-500'>
                            Created: {format(new Date(ticket.created_at), 'PPpp')}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 