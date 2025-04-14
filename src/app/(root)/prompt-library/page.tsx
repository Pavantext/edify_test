"use client";

import { Button } from "@/components/ui/button";
import React, { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Copy, Clock, Calendar, Star } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";


interface SearchResultBase {
    id: string;
    type: 'prompt' | 'qa' | 'peel' | 'mcq' | 'clarify' | 'challenge' | 'perspective' | 'rubric' | 'sow' | 'quiz' | 'lesson';
    createdAt: string;
    complexity?: string;
    processing_time_ms?: number;
    generation_model?: string;
    originalPrompt?: string;
    input_original_prompt?: string;
    refinedPrompts?: PromptResult ['refinedPrompts'];
    //qa
    input_topic?: string;
    //peel
    peelContent?: {
        point: string;
        evidence: string;
        explanation: string;
        link: string;
        feedback?: {
            strengths: string;
            improvements: string;
        };
    };
    //mcq
    topic?: string;
    difficulty?: string;
    total_questions?: number;
    taxonomy_levels?: string[];
    //clarify and challenge
    input_text?: string;
    audience?: string;
    main_argument?: string;
    key_concepts?: { title: string; description: string }[];
    critical_details?: string[];
    applications_in_practice?: { example: string; description: string }[];
    critical_reflection_questions?: string[];
    advanced_concepts?: { concept: string; explanation: string }[];
    //perspective
    output_text?: string | {
        keyPoints?: string[];
        summary?: string;
        counterpoints?: string[];
        recommendations?: string;
        target_audience?: string;
        intended_audience?: string;
        main_argument?: string;
        key_concepts?: Array<{ title: string; description: string }>;
        critical_details?: string[];
        applications_in_practice?: Array<{ example: string; description: string }>;
        counterarguments?: string[];
        advanced_concepts?: Array<{ concept: string; explanation: string }>;
        future_challenges?: string[];
    };
    input: string;
    analysis?: PerspectiveChallengeResult['analysis'];
    //rubric
    ai_response: RubricAIResponse;
    created_at: string;
    assessment_type: string;
    additional_instructions?: string;
    //sow
    sow_data: SOWData;
    //quiz
    quiz_data: QuizData;
    //lesson
    ai_lesson_plan: AILessonPlan;
    input_special_considerations: SpecialConsiderations;
}

interface PromptResult extends SearchResultBase {
    id: string;
    type: 'prompt';
    originalPrompt: string;
    refinedPrompts: Array<{
        promptText: string;
        explanation: {
            focusAreas: string[];
            explanation: string;
            complexityLevel: {
                bloomsLevel: string;
                refinedLevel: string;
            };
        };
        ratings: {
            averageRating: number;
            totalRatings: number;
        };
    }>;
    createdAt: string;
    processing_time_ms?: number;
    generation_model?: string;
    input_original_prompt?: string;
    complexity?: string;
}

interface QAResult extends SearchResultBase {
    id: string;
    type: 'qa';
    input_topic: string;
    questions: Array<{
        level: string;
        question: string;
        exampleResponse: string;
    }>;
    createdAt: string;
    complexity?: string;
    processing_time_ms?: number;
    generation_model?: string;
}

interface PEELResult extends SearchResultBase {
    id: string;
    type: 'peel';
    topic: string;
    peelContent: {
        point: string;
        evidence: string;
        explanation: string;
        link: string;
        feedback?: {
            strengths: string;
            improvements: string;
        };
    };
    createdAt: string;
    processing_time_ms?: number;
    generation_model?: string;
}

export interface Answer {
    text: string;
    is_correct: boolean;
    explanation?: string;
}

export interface MCQResult extends SearchResultBase {
    type: 'mcq';
    topic: string;
    difficulty: string;
    total_questions: number;
    taxonomy_levels: string[];
    questions_data: Array<{
        text: string;
        answers: Answer[];
        explanation?: string;
        taxonomy_level?: string;
    }>;
    created_at: string;
    processing_time_ms?: number;
    generation_model?: string;
}

interface ClarifyChallengeResult extends SearchResultBase {
    type: 'clarify' | 'challenge';
    input_text: string;
    output_text: NonNullable<SearchResultBase['output_text']>;
    audience?: string;
}

interface PerspectiveChallengeResult extends SearchResultBase {
    type: 'perspective';
    id: string;
    input: string;
    analysis: {
        mainPoints: {
            mainArgument: string;
            keyPoints: string[];
            implicitAssumptions?: string[];
        };
        alternativePerspectives: Array<{
            title: string;
            points: string[];
        }>;
        evidenceExploration: {
            supporting: string[];
            challenging: string[];
            researchQuestions?: string[];
        };
        biasAssessment: {
            potentialBiases: string[];
            reductionSuggestions: string[];
        };
        adaptabilitySuggestions: string[];
    };
    created_at: string;
}

interface RubricResult extends SearchResultBase {
    type: 'rubric';
    assignment_type: string;
    custom_assignment_type?: string;
    key_stage: string;
    year_group: number;
    assessment_type: string;
    criteria: string[];
    additional_instructions?: string;
    ai_response: RubricAIResponse;
    topic?: string;
    custom_grading_levels?: string[];
    document_text?: string;
}

interface RubricAIResponse {
    data: {
        id: string;
        version: string;
        createdAt: string;
        metadata: {
            subject: string;
            topic: string;
            assessmentType: string;
            assessor: string;
            keyStage: string;
            level: number;
        };
        rubric: {
            criteria: Array<{
                name: string;
                levels: {
                    proficient: {
                        score: number;
                        description: string;
                        feedback: string;
                    };
                    basic: {
                        score: number;
                        description: string;
                        feedback: string;
                    };
                    emerging: {
                        score: number;
                        description: string;
                        feedback: string;
                    };
                };
            }>;
        };
    };
}

interface SOWResult extends SearchResultBase {
    type: 'sow';
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

  export interface QuizResult extends SearchResultBase {
    type: 'quiz';
    topic: string;
    difficulty: string;
    quiz_data: QuizData;
    subject?: string;
    grade_level?: string;
    "metadata": {
      "title": "string",
      "subject": "string",
      "createdAt": "string (ISO 8601 format)",
      "difficulty": "string",
      "gradeLevel": "string",
      "lastUpdated": "string (ISO 8601 format)",
      "totalPoints": "integer"
    },
    "questions": [
      {
        "points": "integer",
        "options": [
          {
            "text": "string",
            "isCorrect": "boolean",
            "explanation": "string"
          }
        ],
        "difficulty": "string",
        "explanation": "string",
        "questionText": "string",
        "questionType": "string"
      }
    ],
    "instructions": [
      "string"
    ]
  }

  export interface QuizData {
    metadata: {
      title: string;
      subject: string;
      gradeLevel: string;
      difficulty: string;
      totalPoints: number;
      createdAt: string;
    };
    questions: Array<{
      questionText: string;
      questionType: 'multiple_choice' | 'true_false' | 'short_answer';
      options: Array<{
        text: string;
        isCorrect: boolean;
        explanation?: string;
      }>;
      correctAnswer?: string;
      explanation: string;
      points: number;
      difficulty: string;
    }>;
    instructions: string[];
  }

  interface AILessonPlan {
    overview: {
      subject: string;
      topic: string;
      yearGroup: string;
      duration: number;
      learningObjectives: {
        main: string[];
        successCriteria: Array<{
          objective: string;
          assessment: {
            method: string;
            evidence: string;
            differentiation: {
              support: string[];
              extension: string[];
            };
          };
        }>;
      };
      lessonStructure: {
        starter: {
          description: string;
          duration: number;
          materials: string[];
          teacherInstructions: string[];
          studentInstructions: string[];
          expectedOutcomes: string[];
        };
        mainActivities: Array<{
          title: string;
          description: string;
          duration: number;
          materials: string[];
          teacherInstructions: string[];
          studentInstructions: string[];
          experimentDetails: {}; // Added experimentDetails
          worksheetContent: {
            questions: string[];
            tasks: string[];
            resources: string[];
          };
          differentiation: {
            support: string[];
            core: string[];
            extension: string[];
          };
        }>;
        plenary: {
          description: string;
          duration: number;
          assessmentMethod: string;
          successIndicators: string[];
          // instructions: string[]; // removed instructions.
        };
      };
      sendSupport: {
        visualSupport: string[];
        auditorySupport: string[];
        dyslexiaSupport: string[];
        autismSupport: string[];
        adhdSupport: string[];
      };
      assessmentStrategies: {
        formative: Array<{
          method: string;
          timing: string;
          successIndicators: string[];
          followUp: string[];
        }>;
        summative: {
          method: string;
          criteria: string[];
          differentiation: {
            support: string[];
            extension: string[];
          };
        };
      };
    };
  }

  interface SpecialConsiderations extends SearchResultBase {
        differentiation: {
            higherAbility: boolean;
            lowerAbility: boolean;
            esl: boolean;
        };
        send: {
            visualImpairment: boolean;
            hearingImpairment: boolean;
            dyslexia: boolean;
            autism: boolean;
            adhd: boolean;
        };
  }
 export interface LessonPlanResult extends SearchResultBase {
    type: 'lesson';
    input_topic: string;
    input_year_group: string;
    input_duration: number;
    input_subject: string;
    input_special_considerations: SpecialConsiderations;
    ai_lesson_plan: AILessonPlan;
    created_at: string;
  }

type SearchResult = PromptResult | QAResult | PEELResult | MCQResult | ClarifyChallengeResult | PerspectiveChallengeResult | RubricResult | SOWResult | QuizResult | LessonPlanResult;

export default function PromptLibraryPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedPrompt, setSelectedPrompt] = useState<SearchResult | null>(null);
    const [selectedQA, setSelectedQA] = useState<SearchResult | null>(null);
    const [selectedPEEL, setSelectedPEEL] = useState<SearchResult | null>(null);
    const [selectedMCQ, setSelectedMCQ] = useState<SearchResult | null>(null);
    const [selectedClarifyChallenge, setSelectedClarifyChallenge] = useState<SearchResult | null>(null);
    const [selectedPerspectiveChallenge, setSelectedPerspectiveChallenge] = useState<SearchResult | null>(null);
    const [selectedRubric, setSelectedRubric] = useState<SearchResult | null>(null);
    const [selectedSOW, setSelectedSOW] = useState<SearchResult | null>(null);
    const [selectedQuiz, setSelectedQuiz] = useState<SearchResult | null>(null);
    const [selectedLessonPlan, setSelectedLessonPlan] = useState<SearchResult | null>(null);

    const isPromptResult = (result: SearchResult): result is PromptResult =>
        result.type === 'prompt';

    const isQAResult = (result: SearchResult): result is QAResult =>
        result.type === 'qa' && 'exampleResponse' in result.questions[0];

    const isPEELResult = (result: SearchResult): result is PEELResult =>
        result.type === 'peel';

    const isMCQResult = (result: SearchResult): result is MCQResult =>
        result.type === 'mcq' && 'choices' in result.questions_data[0];

    const isClarifyChallengeResult = (result: SearchResult): result is ClarifyChallengeResult =>
        result.type === 'clarify' || result.type === 'challenge';

    const isPerspectiveChallengeResult = (result: SearchResult): result is PerspectiveChallengeResult =>
        result.type === 'perspective';

    const isRubricResult = (result: SearchResult): result is RubricResult =>
        result.type === 'rubric';

    const isSOWResult = (result: SearchResult): result is SOWResult =>
        result.type === 'sow';

    const isQuizResult = (result: SearchResult): result is QuizResult =>
        result.type === 'quiz';

    const isLessonPlanResult = (result: SearchResult): result is LessonPlanResult =>
        result.type === 'lesson';


    const handleSearch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);
        setSearchResults([]);

        try {
            const [
                promptResponse,
                qaResponse,
                peelResponse,
                mcqResponse,
                clarifyResponse,
                perspectiveResponse,
                rubricResponse,
                sowResponse,
                quizResponse,
                lessonPlanResponse
            ] = await Promise.all([
                fetch("/api/prompt-lib/prompt-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/qa-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/peel-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/mcq-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/clarify-challenge-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/perspective-challenge-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/rubric-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/sow-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch("/api/prompt-lib/quiz-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: searchQuery.trim() }),
                }),
                fetch('/api/prompt-lib/lesson-plan-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: searchQuery }),
                }),
            ]);

            const [
                promptData,
                qaData,
                peelData,
                mcqData,
                clarifyData,
                perspectiveData,
                rubricData,
                sowData,
                quizData,
                lessonPlanData
            ] = await Promise.all([
                promptResponse.json(),
                qaResponse.json(),
                peelResponse.json(),
                mcqResponse.json(),
                clarifyResponse.json(),
                perspectiveResponse.json(),
                rubricResponse.json(),
                sowResponse.json(),
                quizResponse.json(),
                lessonPlanResponse.json()
            ]);


            const combinedResults = [
                ...(promptData.results || []).map((p: any) => ({
                    ...p,
                    type: 'prompt',
                    originalPrompt: p.input_original_prompt,
                    ratings: p.ratings
                })),
                ...(qaData.results || []).map((qa: any) => ({
                    ...qa,
                    type: 'qa',
                    questions: qa.questions || []
                })),
                ...(peelData.results || []).map((peel: any) => ({
                    ...peel,
                    type: 'peel',
                    peelContent: {
                        ...peel.peelContent,
                        feedback: peel.feedback
                    }
                })),
                ...(mcqData.results || []).map((mcq: any) => ({
                    ...mcq,
                    type: 'mcq',
                    questions: mcq.questions_data
                })),
                ...(clarifyData.results || []).map((c: any) => ({
                    ...c,
                    type: c.type,
                    output_text: typeof c.output_text === 'string'
                        ? JSON.parse(c.output_text)
                        : c.output_text
                })),
                ...(perspectiveData.results || []).map((pc: any) => ({
                    ...pc,
                    type: 'perspective' as const,
                    input: pc.input,
                    output_text: pc.analysis,
                })),
                ...(rubricData.results || []).map((r: any) => ({
                    ...r,
                    type: 'rubric' as const,
                    ai_response: r.ai_response
                })),
                ...(sowData.results || []).map((s: any) => ({
                    ...s,
                    type: 'sow' as const,
                    sow_data: s.sow_data
                })),
                ...(quizData.results || []).map((q: any) => ({
                    ...q,
                    type: 'quiz'
                })),
                ...(lessonPlanData.results || []).map((lp: any) => ({
                    ...lp,
                    type: 'lesson',
                    input_topic: lp.input_topic,
                    input_year_group: lp.input_year_group,
                    input_duration: lp.input_duration,
                    input_subject: lp.input_subject,
                    input_special_considerations: lp.input_special_considerations,
                    ai_lesson_plan: lp.ai_lesson_plan,
                    created_at: lp.created_at
                })),
            ];

            setSearchResults(combinedResults.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ));

        } catch (error) {
            setError('Failed to load search results');
            console.error("Search error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        console.log("Search Results State:", searchResults);
    }, [searchResults]);

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Prompt copied to clipboard");
        } catch (err) {
            toast.error("Failed to copy text to clipboard");
        }
    }, []);

    const formatDate = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    useEffect(() => {
        const abortController = new AbortController();

        // Cleanup function
        return () => {
            abortController.abort();
        };
    }, [searchQuery]);

    const handleResultClick = (result: SearchResult) => {
        if (result.type === 'lesson') {
            setSelectedLessonPlan(result);
        } else if (result.type === 'quiz') {
            setSelectedQuiz(result);
        } else if (result.type === 'sow') {
            setSelectedSOW(result);
        } else if (result.type === 'rubric') {
            setSelectedRubric(result);
        } else if (result.type === 'perspective') {
            setSelectedPerspectiveChallenge(result);
        } else if (result.type === 'clarify' || result.type === 'challenge') {
            setSelectedClarifyChallenge(result);
        } else {
            console.log("Clicked result:", result);
            if (result.type === 'mcq') {
                setSelectedMCQ(result);
            } else if (result.type === 'qa') {
                setSelectedQA(result);
            } else if (result.type === 'peel') {
                setSelectedPEEL(result);
            } else {
                setSelectedPrompt(result);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Prompt Library</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Search through your collection of original prompts and AI-refined versions.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleSearch} className="flex justify-center items-center gap-4 mb-8">
                        <Input
                            type="text"
                            placeholder="Search prompts ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 p-6 text-lg rounded-lg shadow-sm"
                        />
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="p-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Searching...
                                </>
                            ) : (
                                <>
                                    <Search className="w-5 h-5 mr-2" />
                                    Search
                                </>
                            )}
                        </Button>
                    </form>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                            {error}
                        </div>
                    )}


                    {/* PromptGenerator */}
                    <div className="space-y-6">
                        {searchResults.map((result) => (
                            <Card
                                key={result.id}
                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => handleResultClick(result)}
                            >
                                <CardHeader>
                                    <div className="space-y-4">
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <Badge variant="secondary" className="mb-2">
                                                        {result.type === 'qa' ? 'QA Generator' : result.type === 'peel' ? 'PEEL Generator' : result.type === 'mcq' ? 'MCQs Generator' : result.type === 'clarify' || result.type === 'challenge' ? 'Clarify/Challenge Generator' : result.type === 'perspective' ? 'Perspective Challenge Generator' : result.type === 'rubric' ? 'Rubric Generator' : result.type === 'sow' ? 'SOW Generator' : result.type === 'quiz' ? 'Quiz Generator' : result.type === 'lesson' ? 'Lesson Plan Generator' : 'Prompt Generator'}
                                                    </Badge>
                                                    <CardTitle className="text-xl">
                                                        {result.type === 'lesson' ? result.ai_lesson_plan.overview?.topic : result.type === 'quiz' ? result.quiz_data.metadata.title : result.type === 'sow' ? result.sow_data?.data?.topic || '' : result.type === 'rubric' ? result.ai_response?.data?.metadata?.topic : result.type === 'perspective' ? result.input : result.type === 'clarify' || result.type === 'challenge' ? result.input_text : result.type === 'mcq' ? result.topic : result.type === 'peel' ? result.topic : result.type === 'qa' ? result.input_topic : result.originalPrompt}
                                                    </CardTitle>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyToClipboard(
                                                            result.type === 'lesson' ? result.ai_lesson_plan?.overview?.topic || ''
                                                                : result.type === 'quiz' ? result.quiz_data.metadata.title || ''
                                                                    : result.type === 'sow' ? result.sow_data?.data?.topic || ''
                                                                        : result.type === 'rubric' ? result.ai_response?.data?.metadata?.assessmentType || ''
                                                                            : result.type === 'perspective' ? result.analysis.mainPoints.mainArgument
                                                                                : result.type === 'clarify' || result.type === 'challenge' ? (typeof result.output_text === 'string' ? result.output_text : result.output_text?.main_argument || '')
                                                                                    : result.type === 'mcq' ? result.questions_data?.[0]?.text || ''
                                                                                        : result.type === 'peel' ? result.peelContent?.point || ''
                                                                                            : result.type === 'qa' ? result.questions?.[0]?.question || ''
                                                                                                : result.originalPrompt || ''
                                                        );
                                                    }}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Created: {formatDate(result.createdAt)}
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}

                        {searchResults.length === 0 && !isLoading && searchQuery && (
                            <div className="text-center py-8">
                                <p className="text-gray-600">No prompts found matching your search.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            <Dialog open={!!selectedPrompt || !!selectedQA || !!selectedPEEL || !!selectedMCQ || !!selectedClarifyChallenge || !!selectedPerspectiveChallenge || !!selectedRubric || !!selectedSOW || !!selectedQuiz || !!selectedLessonPlan} onOpenChange={(open) => {
                if (!open) {
                    setSelectedPrompt(null);
                    setSelectedQA(null);
                    setSelectedPEEL(null);
                    setSelectedMCQ(null);
                    setSelectedClarifyChallenge(null);
                    setSelectedPerspectiveChallenge(null);
                    setSelectedRubric(null);
                    setSelectedSOW(null);
                    setSelectedQuiz(null);
                    setSelectedLessonPlan(null);
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="sr-only">Dialog Title</DialogTitle>
                    <DialogDescription className="sr-only">
                        Detailed view of selected content
                    </DialogDescription>

                    {selectedPrompt && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span>Prompt Generator</span>
                                    <Badge variant="outline" className="text-sm">
                                        {selectedPrompt.generation_model || 'default-model'}
                                    </Badge>
                                </DialogTitle>
                            </DialogHeader>

                            {/* Metadata Section */}
                            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <span>
                                        Processed in:{" "}
                                        {selectedPrompt.processing_time_ms
                                            ? `${Math.round(selectedPrompt.processing_time_ms / 1000)}s`
                                            : "N/A"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span>
                                        Created: {formatDate(selectedPrompt.createdAt)}
                                    </span>
                                </div>
                            </div>


                            {/* Refined Prompts Section */}
                            <div className="space-y-4">
                                <h3 className="font-medium text-gray-700">AI Refined Versions</h3>
                                {selectedPrompt.refinedPrompts?.map((prompt, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">
                                                        {prompt.explanation.complexityLevel.refinedLevel || 'Level N/A'}
                                                    </Badge>
                                                    <Badge variant="secondary">
                                                        {prompt.explanation.complexityLevel.bloomsLevel || 'Bloom\'s N/A'}
                                                    </Badge>
                                                </div>
                                                <div className="flex gap-2 flex-wrap">
                                                    {prompt.explanation.focusAreas.map((area: string, i: number) => (
                                                        <Badge key={i} variant="default">
                                                            {area}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(prompt.promptText)}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            <pre className="whitespace-pre-wrap text-sm">
                                                {prompt.promptText}
                                            </pre>

                                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                                <h4 className="text-sm font-medium text-blue-800 mb-2">Explanation</h4>
                                                <p className="text-sm text-blue-700">
                                                    {prompt.explanation.explanation || 'No explanation available'}
                                                </p> 
                                            </div>
                                            <div className="flex items-center gap-2">
                                                    <Star className="w-4 h-4 text-yellow-500" />
                                                    <span>
                                                        {prompt.ratings?.averageRating || 'N/A'}
                                                    </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

            {/* Long Answer Question Generator */}
                    {selectedQA && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span>Long QA Generator</span>
                                </DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span>Created: {formatDate(selectedQA.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">Complexity: {selectedQA.complexity || 'N/A'}</Badge>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {(selectedQA as QAResult).questions?.map((question, index) => (
                                    <Card key={index} className="p-6">
                                        <h3 className="font-semibold text-lg text-blue-600 mb-4">
                                            {question.level}
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-medium text-gray-700">Question:</h4>
                                                <p className="mt-1 text-gray-600">{question.question}</p>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-700">Example Response:</h4>
                                                <div className="mt-1 p-4 bg-blue-50 rounded-lg">
                                                    <p className="text-gray-600 whitespace-pre-wrap">
                                                        {question.exampleResponse}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}


                    {/* PEEL Generator */}
                    {selectedPEEL && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span>PEEL Generator</span>
                                </DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span>Created: {formatDate(selectedPEEL.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">Complexity: {selectedPEEL.complexity || 'N/A'}</Badge>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <Card className="p-6">
                                    <h3 className="font-semibold text-lg text-blue-600 mb-4">Point</h3>
                                    <p className="text-gray-600">{selectedPEEL.peelContent?.point}</p>
                                </Card>

                                <Card className="p-6">
                                    <h3 className="font-semibold text-lg text-blue-600 mb-4">Evidence</h3>
                                    <p className="text-gray-600">{selectedPEEL.peelContent?.evidence}</p>
                                </Card>

                                <Card className="p-6">
                                    <h3 className="font-semibold text-lg text-blue-600 mb-4">Explanation</h3>
                                    <p className="text-gray-600">{selectedPEEL.peelContent?.explanation}</p>
                                </Card>

                                <Card className="p-6">
                                    <h3 className="font-semibold text-lg text-blue-600 mb-4">Link</h3>
                                    <p className="text-gray-600">{selectedPEEL.peelContent?.link}</p>
                                </Card>

                                <Card className="p-6">
                                    <h3 className="font-semibold text-lg text-blue-600 mb-4">Feedback</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="font-medium text-gray-700">Strengths:</h4>
                                            <p className="mt-1 text-gray-600">
                                                {selectedPEEL.peelContent?.feedback?.strengths || 'No strengths recorded'}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-700">Improvements:</h4>
                                            <p className="mt-1 text-gray-600">
                                                {selectedPEEL.peelContent?.feedback?.improvements || 'No improvement suggestions'}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}

                    {/* MCQ Generator */}
                    {selectedMCQ && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span>MCQ Generator</span>
                                </DialogTitle>
                            </DialogHeader>

                            {/* Metadata Section */}
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span>Created: {formatDate(selectedMCQ.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">Difficulty: {selectedMCQ.difficulty || 'N/A'}</Badge>
                                </div>
                            </div>

                            {/* Taxonomy Levels Section */}
                            <div className="mb-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Taxonomy Levels:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {(selectedMCQ.taxonomy_levels || []).map((level, index) => (
                                        <Badge key={index} variant="secondary">
                                            {level}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Total Questions Info */}
                            <div className="mb-6 text-sm text-gray-700">
                                <p>Total Questions: {selectedMCQ.total_questions || 0}</p>
                            </div>

                            {/* Questions Section */}
                            <div className="space-y-6">
                                {(selectedMCQ as MCQResult).questions_data?.map((question, index) => (
                                    <Card key={index} className="p-6">
                                        {/* Question Text */}
                                        <h3 className="font-semibold text-lg text-blue-600 mb-4">
                                            Question {index + 1}: {question.text}
                                        </h3>

                                        {/* Options List */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-medium text-gray-700">Options:</h4>
                                                <div className="mt-2 space-y-2">
                                                    {question.answers.map((answer, i) => {
                                                        const isCorrect = answer.is_correct;

                                                        return (
                                                            <div
                                                                key={i}
                                                                className={`p-3 rounded-lg ${isCorrect
                                                                    ? "bg-green-100 border-l-4 border-blue-500"
                                                                    : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                                                                    }`}
                                                            >
                                                                <div className="flex items-start">
                                                                    <div className={`mr-2 font-medium ${isCorrect ? "text-blue-600" : "text-gray-500"}`}>
                                                                        {String.fromCharCode(65 + i)}.
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className={`${isCorrect ? "font-semibold text-blue-700" : "text-gray-600"}`}>
                                                                            {answer.text}
                                                                            {isCorrect && (
                                                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                                                    Correct Answer
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                        {isCorrect && answer.explanation && (
                                                                            <div className="mt-1 text-sm text-green-600">
                                                                                <strong>Explanation:</strong> {answer.explanation}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Overall Explanation for the Question */}
                                        {question.explanation && (
                                            <div className="mt-4 p-2 bg-blue-50 rounded-lg">
                                                <span className="font-medium">Explanation:</span> {question.explanation}
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Clarify and Challenge */}
                    {selectedClarifyChallenge && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span>Clarify and Challenge</span>
                                </DialogTitle>
                                <div className="text-sm text-muted-foreground">
                                    {selectedClarifyChallenge.type === 'clarify'
                                        ? 'Clarification Analysis'
                                        : 'Challenge Analysis'}
                                </div>
                            </DialogHeader>

                            <div className="space-y-6">
                                {/* Common Metadata */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {formatDate(selectedClarifyChallenge.createdAt)}
                                    </div>
                                    {selectedClarifyChallenge.audience && (
                                        <Badge
                                            variant="secondary"
                                            className="border-black-100 text-black-800 text-xs font-medium px-2 py-1"
                                        >
                                            <span className="mr-1.5">Audience: </span>
                                            {selectedClarifyChallenge.audience}
                                        </Badge>
                                    )}
                                </div>

                                {/* Content Display */}
                                {typeof selectedClarifyChallenge.output_text !== 'string' && (
                                    <div className="space-y-6">
                                        {selectedClarifyChallenge.type === 'clarify' ? (
                                            <>
                                                {/* Main Argument */}
                                                {selectedClarifyChallenge.output_text.main_argument && (
                                                    <div className="p-4 bg-blue-50 rounded-lg">
                                                        <h3 className="text-lg font-semibold mb-2">Main Argument</h3>
                                                        <p>{selectedClarifyChallenge.output_text.main_argument}</p>
                                                    </div>
                                                )}

                                                {/* Key Concepts */}
                                                {selectedClarifyChallenge.output_text.key_concepts &&
                                                    selectedClarifyChallenge.output_text.key_concepts.length > 0 && (
                                                        <div>
                                                            <h3 className="text-lg font-semibold mb-2">Key Concepts</h3>
                                                            {selectedClarifyChallenge.output_text.key_concepts.map((concept, index) => (
                                                                <Card key={index}>
                                                                    <CardContent className="p-4">
                                                                        <h4 className="font-medium">{concept.title}</h4>
                                                                        <p>{concept.description}</p>
                                                                    </CardContent>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    )}

                                                {/* Critical Details */}
                                                {selectedClarifyChallenge.output_text.critical_details &&
                                                    selectedClarifyChallenge.output_text.critical_details.length > 0 && (
                                                        <div>
                                                            <h3 className="text-lg font-semibold mb-2">Critical Details</h3>
                                                            <ul className="list-disc pl-5 space-y-2">
                                                                {selectedClarifyChallenge.output_text.critical_details.map((detail, index) => (
                                                                    <li key={index}>{detail}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                {/* Applications in Practice */}
                                                {selectedClarifyChallenge.output_text.applications_in_practice &&
                                                    selectedClarifyChallenge.output_text.applications_in_practice.length > 0 && (
                                                        <div>
                                                            <h3 className="text-lg font-semibold mb-2">Applications in Practice</h3>
                                                            {selectedClarifyChallenge.output_text.applications_in_practice.map((app, index) => (
                                                                <Card key={index}>
                                                                    <CardContent className="p-4">
                                                                        <h4 className="font-medium">{app.example}</h4>
                                                                        <p>{app.description}</p>
                                                                    </CardContent>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    )}
                                            </>
                                        ) : (
                                            <>
                                                {/* Challenge Content */}
                                                {typeof selectedClarifyChallenge.output_text !== 'string' &&
                                                    selectedClarifyChallenge.output_text?.counterarguments?.map((arg, index) => (
                                                        <Card key={index}>
                                                            <CardContent className="p-4">
                                                                <h4 className="font-medium">Counterargument {index + 1}</h4>
                                                                <p>{arg}</p>
                                                            </CardContent>
                                                        </Card>
                                                    ))}

                                                {typeof selectedClarifyChallenge.output_text !== 'string' &&
                                                    selectedClarifyChallenge.output_text?.advanced_concepts?.map((concept, index) => (
                                                        <Card key={index}>
                                                            <CardContent className="p-4">
                                                                <h4 className="font-medium">{concept.concept}</h4>
                                                                <p>{concept.explanation}</p>
                                                            </CardContent>
                                                        </Card>
                                                    ))}

                                                {selectedClarifyChallenge.output_text?.future_challenges &&
                                                    selectedClarifyChallenge.output_text?.future_challenges.length > 0 && (
                                                        <div>
                                                            <h3 className="text-lg font-semibold mb-2">Future Challenges</h3>
                                                            <ul className="list-disc pl-5 space-y-2">
                                                                {selectedClarifyChallenge.output_text.future_challenges.map((challenge, index) => (
                                                                    <li key={index}>{challenge}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}


                    {/* Perspective Challenge */}
                    {selectedPerspectiveChallenge && (
                        <>
                            <DialogHeader className="space-y-2">
                                <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                                    <span>Perspective Challenge</span>
                                </DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    <span className="truncate">Created: {formatDate(selectedPerspectiveChallenge.created_at || selectedPerspectiveChallenge.createdAt)}</span>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Main Argument */}
                                <Card>
                                    <CardHeader className="p-4 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Main Argument</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-6 pt-0">
                                        <p className="text-sm sm:text-base whitespace-pre-wrap">
                                            {selectedPerspectiveChallenge.analysis?.mainPoints?.mainArgument}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* Key Points */}
                                <Card>
                                    <CardHeader className="p-4 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Key Points</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-6 pt-0">
                                        <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                            {(selectedPerspectiveChallenge.analysis?.mainPoints?.keyPoints ?? []).map((point, index) => (
                                                <li key={index}>{point}</li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>

                                {/* Implicit Assumptions */}
                                <Card>
                                    <CardHeader className="p-4 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Implicit Assumptions</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-6 pt-0">
                                        <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                            {(selectedPerspectiveChallenge.analysis?.mainPoints?.implicitAssumptions ?? []).map((assumption, index) => (
                                                <li key={index}>{assumption}</li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>

                                {/* Bias Assessment */}
                                <Card>
                                    <CardHeader className="p-4 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Bias Analysis</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
                                        <div>
                                            <h4 className="font-medium mb-2 text-sm sm:text-base">Potential Biases</h4>
                                            <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                                {(selectedPerspectiveChallenge.analysis?.biasAssessment?.potentialBiases ?? []).map((bias, index) => (
                                                    <li key={index}>{bias}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-medium mb-2 text-sm sm:text-base">Reduction Suggestions</h4>
                                            <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                                {(selectedPerspectiveChallenge.analysis?.biasAssessment?.reductionSuggestions ?? []).map((suggestion, index) => (
                                                    <li key={index}>{suggestion}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Evidence Exploration */}
                                <Card>
                                    <CardHeader className="p-4 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Evidence Analysis</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-6 pt-0">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-green-50 p-4 rounded-lg">
                                                <h4 className="font-medium mb-2 text-sm sm:text-base">Supporting Evidence</h4>
                                                <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                                    {(selectedPerspectiveChallenge.analysis?.evidenceExploration?.supporting ?? []).map((evidence, index) => (
                                                        <li key={index}>{evidence}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="bg-red-50 p-4 rounded-lg">
                                                <h4 className="font-medium mb-2 text-sm sm:text-base">Challenging Evidence</h4>
                                                <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                                    {(selectedPerspectiveChallenge.analysis?.evidenceExploration?.challenging ?? []).map((evidence, index) => (
                                                        <li key={index}>{evidence}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Research Questions */}
                                        <div className="mt-4">
                                            <h4 className="font-medium mb-2 text-sm sm:text-base">Research Questions</h4>
                                            <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                                {(selectedPerspectiveChallenge.analysis?.evidenceExploration?.researchQuestions ?? []).map((question, index) => (
                                                    <li key={index}>{question}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Adaptability Suggestions */}
                                <Card>
                                    <CardHeader className="p-4 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Adaptability Suggestions</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-6 pt-0">
                                        <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                            {(selectedPerspectiveChallenge.analysis?.adaptabilitySuggestions ?? []).map((suggestion, index) => (
                                                <li key={index}>{suggestion}</li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>

                                {/* Alternative Perspectives */}
                                <Card>
                                    <CardHeader className="p-4 sm:p-6">
                                        <CardTitle className="text-base sm:text-lg">Alternative Perspectives</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
                                        {(selectedPerspectiveChallenge.analysis?.alternativePerspectives ?? []).map((perspective, index) => (
                                            <div key={index} className="bg-blue-50 p-4 rounded-lg">
                                                <h4 className="font-medium mb-2 text-sm sm:text-base">{perspective.title}</h4>
                                                <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base">
                                                    {perspective.points.map((point, pointIndex) => (
                                                        <li key={pointIndex}>{point}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}


                    {/* Rubric Generator */}
                    {selectedRubric && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span>Rubric Generator</span>
                                </DialogTitle>
                            </DialogHeader>

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    <span>Created: {formatDate(selectedRubric.created_at)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                        Stage: {selectedRubric.ai_response?.data?.metadata?.keyStage}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Subject</p>
                                    <p>{selectedRubric.ai_response?.data?.metadata?.subject || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Assessment Type</p>
                                    <p>{selectedRubric.assessment_type}</p>
                                </div>
                            </div>

                            {/* Rubric Criteria */}
                            <div className="space-y-6">
                                {selectedRubric.ai_response?.data?.rubric?.criteria?.map((criterion, index) => (
                                    <Card key={index} className="p-6">
                                        <h3 className="font-semibold text-lg text-primary mb-4">
                                            {criterion.name}
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {Object.entries(criterion.levels || {}).map(([levelName, level]) => (
                                                <div
                                                    key={levelName}
                                                    className="border rounded-lg p-4 bg-muted/50"
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="capitalize font-medium">{levelName}</span>
                                                        <Badge variant="secondary">Score: {level.score}</Badge>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div>
                                                            <p className="text-sm font-medium text-muted-foreground">Description</p>
                                                            <p className="text-sm">{level.description}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-muted-foreground">Feedback</p>
                                                            <p className="text-sm">{level.feedback}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                ))}
                            </div>

                            {/* Additional Instructions */}
                            {selectedRubric.additional_instructions && (
                                <Card className="p-6">
                                    <h3 className="font-semibold text-lg text-primary mb-4">
                                        Additional Instructions
                                    </h3>
                                    <p className="text-sm whitespace-pre-wrap">
                                        {selectedRubric.additional_instructions}
                                    </p>
                                </Card>
                            )}
                        </>
                    )}


                    {/* SOW Generator */}
                    {selectedSOW && (
                        <Dialog open={!!selectedSOW} onOpenChange={() => setSelectedSOW(null)}>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">
                                        <span>Scheme of Work</span>
                                    </DialogTitle>
                                    <DialogDescription>
                                        Subject: {selectedSOW.sow_data.data.subject} | Year Group: {selectedSOW.sow_data.data.ageGroup.year}
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-6">
                                    {/* Metadata Section */}
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                                        <div>
                                            <p className="font-medium">Author:</p>
                                            <p>{selectedSOW.sow_data.data.metadata.author}</p>
                                        </div>
                                        <div>
                                            <p className="font-medium">Created:</p>
                                            <p>{formatDate(selectedSOW.sow_data.data.metadata.createdAt)}</p>
                                        </div>
                                    </div>

                                    {/* Overarching Objectives */}
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <h3 className="font-semibold mb-2">Overarching Objectives</h3>
                                        <ul className="list-disc pl-6 space-y-2">
                                            {selectedSOW.sow_data.data.overarchingObjectives.map((obj: string, i: number) => (
                                                <li key={i}>{obj}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Lessons Table */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-sm font-medium">Lesson</th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium">Duration</th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium">Learning Objectives</th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium">Activities</th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium">Assessment</th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium">Differentiation</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {selectedSOW.sow_data.data.lessons.map((lesson, index) => (
                                                    <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                        <td className="px-4 py-4 align-top">
                                                            <span className="font-medium">Lesson {lesson.lessonNumber}:</span>
                                                            <br />
                                                            {lesson.title}
                                                        </td>
                                                        <td className="px-4 py-4 align-top">{lesson.duration} mins</td>
                                                        <td className="px-4 py-4 align-top">
                                                            <ul className="list-disc pl-4">
                                                                {lesson.learningObjectives.map((obj: string, i: number) => (
                                                                    <li key={i}>{obj}</li>
                                                                ))}
                                                            </ul>
                                                        </td>
                                                        <td className="px-4 py-4 align-top">
                                                            {lesson.activities.map((activity: any, i: number) => (
                                                                <div key={i} className="mb-4">
                                                                    <p className="font-medium">{activity.title}</p>
                                                                    <p>{activity.description}</p>
                                                                    {activity.resources && (
                                                                        <div className="mt-2">
                                                                            <p className="text-sm font-medium">Resources:</p>
                                                                            <ul className="list-disc pl-4">
                                                                                {activity.resources.map((resource: string, ri: number) => (
                                                                                    <li key={ri} className="text-sm">{resource}</li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </td>
                                                        <td className="px-4 py-4 align-top">
                                                            <ul className="list-disc pl-4">
                                                                {lesson.assessment?.map((item: string, i: number) => (
                                                                    <li key={i}>{item}</li>
                                                                ))}
                                                            </ul>
                                                        </td>
                                                        <td className="px-4 py-4 align-top">
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <p className="font-medium text-sm">Core:</p>
                                                                    <ul className="list-disc pl-4">
                                                                        {lesson.differentiation?.core?.map((item: string, i: number) => (
                                                                            <li key={i} className="text-sm">{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-sm">Support:</p>
                                                                    <ul className="list-disc pl-4">
                                                                        {lesson.differentiation?.support?.map((item: string, i: number) => (
                                                                            <li key={i} className="text-sm">{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-sm">Extension:</p>
                                                                    <ul className="list-disc pl-4">
                                                                        {lesson.differentiation?.extension?.map((item: string, i: number) => (
                                                                            <li key={i} className="text-sm">{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}


                    {/* Quiz Generator */}
                    {selectedQuiz && (
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{selectedQuiz.quiz_data.metadata.title}</DialogTitle>
                                <div className="text-sm text-gray-500">
                                    <p>Subject: {selectedQuiz.quiz_data.metadata.subject}</p>
                                    <p>Grade: {selectedQuiz.quiz_data.metadata.gradeLevel}</p>
                                    <p>Total Points: {selectedQuiz.quiz_data.metadata.totalPoints}</p>
                                </div>
                            </DialogHeader>

                            <div className="space-y-6">
                                {selectedQuiz.quiz_data.questions.map((question, index) => (
                                    <Card key={index} className="p-4">
                                        <div className="flex justify-between mb-2">
                                            <h3 className="font-semibold">Question {index + 1}</h3>
                                            <span className="text-sm text-gray-500">
                                                {question.points} points
                                            </span>
                                        </div>
                                        <p className="mb-4">{question.questionText}</p>

                                        {question.questionType === 'multiple_choice' && (
                                            <div className="space-y-2">
                                                {question.options.map((option, optIndex) => (
                                                    <div key={optIndex} className={`p-3 rounded-lg ${option.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                                                        }`}>
                                                        <p>{option.text}</p>
                                                        {option.explanation && (
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                {option.explanation}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {question.questionType === 'short_answer' && (
                                            <div className="bg-blue-50 p-3 rounded-lg">
                                                <p className="font-medium">Answer: {question.correctAnswer}</p>
                                            </div>
                                        )}

                                        {question.explanation && (
                                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                                <p className="text-sm text-gray-600">{question.explanation}</p>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </DialogContent>
                    )}

                    {/* Lesson Plan Generator */}
                    {selectedLessonPlan && (
                        <Dialog open={!!selectedLessonPlan} onOpenChange={() => setSelectedLessonPlan(null)}>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">
                                        {selectedLessonPlan.ai_lesson_plan.overview.topic}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Subject: {selectedLessonPlan.ai_lesson_plan.overview.subject} | 
                                        Year Group: {selectedLessonPlan.ai_lesson_plan.overview.yearGroup} | 
                                        Duration: {selectedLessonPlan.ai_lesson_plan.overview.duration} minutes
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-6">
                                    {/* Learning Objectives */}
                                    <Card className="p-6">
                                        <h3 className="font-semibold text-lg text-primary mb-4">Learning Objectives</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">Main Objectives</p>
                                                <ul className="list-disc pl-6 mt-2">
                                                    {selectedLessonPlan.ai_lesson_plan.overview.learningObjectives.main?.map((obj, i) => (
                                                        <li key={i} className="text-sm">{obj}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            {selectedLessonPlan.ai_lesson_plan.overview.learningObjectives.successCriteria?.map((criteria, i) => (
                                                <div key={i} className="mt-4">
                                                    <p className="font-medium">{criteria.objective}</p>
                                                    <div className="pl-4 border-l-2 border-primary">
                                                        <p className="text-sm text-muted-foreground">
                                                            <span className="font-medium">Assessment:</span> {criteria.assessment.method}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            <span className="font-medium">Evidence:</span> {criteria.assessment.evidence}
                                                        </p>
                                                        <div className="mt-2">
                                                            <p className="text-xs font-medium text-muted-foreground">Differentiation Support:</p>
                                                            <ul className="list-disc pl-4">
                                                                {criteria.assessment.differentiation.support.map((item, j) => (
                                                                    <li key={j} className="text-xs">{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="mt-1">
                                                            <p className="text-xs font-medium text-muted-foreground">Extension Activities:</p>
                                                            <ul className="list-disc pl-4">
                                                                {criteria.assessment.differentiation.extension.map((item, j) => (
                                                                    <li key={j} className="text-xs">{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>

                                    {/* Lesson Structure */}
                                    <Card className="p-6">
                                        <h3 className="font-semibold text-lg text-primary mb-4">Lesson Structure</h3>
                                        
                                        {/* Starter */}
                                        <div className="mb-6">
                                            <h4 className="font-medium mb-2">Starter Activity</h4>
                                            <p className="text-sm">{selectedLessonPlan.ai_lesson_plan.overview.lessonStructure.starter?.description}</p>
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">Materials Needed</p>
                                                    <ul className="list-disc pl-6">
                                                        {selectedLessonPlan.ai_lesson_plan.overview.lessonStructure.starter?.materials?.map((mat, i) => (
                                                            <li key={i} className="text-sm">{mat}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Expected Outcomes</p>
                                                        <ul className="list-disc pl-6">
                                                            {selectedLessonPlan.ai_lesson_plan.overview.lessonStructure.starter?.expectedOutcomes.map((outcome, i) => (
                                                                <li key={i} className="text-sm">{outcome}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Main Activities */}
                                        {selectedLessonPlan.ai_lesson_plan.overview.lessonStructure.mainActivities.map((activity, i) => (
                                            <div key={i} className="mb-6">
                                                <h4 className="font-medium mb-2">{activity.title}</h4>
                                                <p className="text-sm">{activity.description}</p>
                                                <div className="grid grid-cols-3 gap-4 mt-4">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Worksheet Content</p>
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-medium">Questions:</p>
                                                            <ul className="list-disc pl-4">
                                                                {activity.worksheetContent.questions.map((q, j) => (
                                                                    <li key={j} className="text-xs">{q}</li>
                                                                ))}
                                                            </ul>
                                                            <p className="text-xs font-medium mt-2">Tasks:</p>
                                                            <ul className="list-disc pl-4">
                                                                {activity.worksheetContent.tasks.map((task, j) => (
                                                                    <li key={j} className="text-xs">{task}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Differentiation Strategies</p>
                                                        <div className="space-y-2">
                                                            <div>
                                                                <p className="text-xs font-medium">Support:</p>
                                                                <ul className="list-disc pl-4">
                                                                    {activity.differentiation.support.map((item, j) => (
                                                                        <li key={j} className="text-xs">{item}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium">Extension:</p>
                                                                <ul className="list-disc pl-4">
                                                                    {activity.differentiation.extension.map((item, j) => (
                                                                        <li key={j} className="text-xs">{item}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Resources</p>
                                                        <ul className="list-disc pl-6">
                                                            {activity.materials.map((mat, j) => (
                                                                <li key={j} className="text-sm">{mat}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Plenary */}
                                        <div>
                                            <h4 className="font-medium mb-2">Plenary Session</h4>
                                            <p className="text-sm">{selectedLessonPlan.ai_lesson_plan.overview.lessonStructure.plenary?.description}</p>
                                            <div className="mt-4">
                                                <p className="text-sm font-medium text-muted-foreground">Success Indicators</p>
                                                <ul className="list-disc pl-6">
                                                    {selectedLessonPlan.ai_lesson_plan.overview.lessonStructure.plenary?.successIndicators.map((ind, i) => (
                                                        <li key={i} className="text-sm">{ind}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Assessment Strategies */}
                                    <Card className="p-6">
                                        <h3 className="font-semibold text-lg text-primary mb-4">Assessment Strategies</h3>
                                        <Tabs defaultValue="formative">
                                            <TabsList className="grid grid-cols-2 w-1/2">
                                                <TabsTrigger value="formative">Formative</TabsTrigger>
                                                <TabsTrigger value="summative">Summative</TabsTrigger>
                                            </TabsList>
                                            
                                            <TabsContent value="formative">
                                                {selectedLessonPlan.ai_lesson_plan.overview.assessmentStrategies?.formative.map((strategy, i) => (
                                                    <div key={i} className="mt-4">
                                                        <p className="font-medium">{strategy.method}</p>
                                                        <p className="text-sm text-muted-foreground">Timing: {strategy.timing}</p>
                                                        <div className="mt-2">
                                                            <p className="text-xs font-medium">Follow-up Actions:</p>
                                                            <ul className="list-disc pl-4">
                                                                {strategy.followUp.map((action, j) => (
                                                                    <li key={j} className="text-xs">{action}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                ))}
                                            </TabsContent>
                                            
                                            <TabsContent value="summative">
                                                <div className="mt-4">
                                                    <p className="font-medium">{selectedLessonPlan.ai_lesson_plan.overview.assessmentStrategies?.summative.method}</p>
                                                    <p className="text-sm text-muted-foreground">Criteria: {selectedLessonPlan.ai_lesson_plan.overview.assessmentStrategies?.summative.criteria.join(', ')}</p>
                                                    <div className="mt-2">
                                                        <p className="text-xs font-medium">Differentiation Support:</p>
                                                        <ul className="list-disc pl-4">
                                                            {selectedLessonPlan.ai_lesson_plan.overview.assessmentStrategies?.summative.differentiation.support.map((item, j) => (
                                                                <li key={j} className="text-xs">{item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div className="mt-1">
                                                        <p className="text-xs font-medium">Extension Activities:</p>
                                                        <ul className="list-disc pl-4">
                                                            {selectedLessonPlan.ai_lesson_plan.overview.assessmentStrategies?.summative.differentiation.extension.map((item, j) => (
                                                                <li key={j} className="text-xs">{item}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </Card>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}