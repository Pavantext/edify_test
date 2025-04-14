"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Loader2,
  Download,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  Eye,
  Edit,
  Share2,
  ChevronDown,
} from "lucide-react";
import { ReportButton } from "@/components/ReportButton";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Document, Packer, Paragraph, TextRun, ImageRun, Header } from "docx";
import axios from "axios";
import { toast } from "sonner";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import SubscriptionDialog from "@/components/SubscriptionDialog";

interface Question {
  level: string;
  question: string;
  exampleResponse: string;
}

interface GeneratedQuestions {
  questions: Question[];
}

interface ApiResponse {
  data: {
    id: string;
    ai_generated_questions: GeneratedQuestions;
  };
  error?: string;
}

interface ErrorState {
  message: string;
  details?: string | { status?: string; contentFlags?: Record<string, boolean> };
}

export default function QuestionGenerator() {
  const [inputType, setInputType] = useState<"topic" | "file">("topic");
  const [topic, setTopic] = useState("");
  const [isChecked, setIsChecked] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [savedResponseId, setSavedResponseId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [numberOfQuestions, setNumberOfQuestions] = useState<number>(5);
  const [complexity, setComplexity] = useState<"KS3" | "KS4" | "Advanced">(
    "KS3"
  );
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [inputData, setInputData] = useState({
    topic: "",
    numQuestions: 5,
    difficulty: "KS3",
    questionType: "",
    language: "",
    customInstructions: ""
  });
  const [isApprovedContent, setIsApprovedContent] = useState(false);

  const bloomLevels = [
    "Remembering",
    "Understanding",
    "Applying",
    "Analysing",
    "Evaluating",
    "Creating",
  ];

  // Add useEffect to fetch questions when approved ID is present
  useEffect(() => {
    const fetchApprovedQuestions = async (approvedId: string) => {
      try {
        setLoading(true);
        setError(null);
        setIsApprovedContent(true);
        console.log("Fetching approved content with ID:", approvedId);
        
        const response = await fetch(`/api/tools/long-qa-generator/${approvedId}?approved=true`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch approved questions");
        }
        
        const data = await response.json();
        console.log("Received approved content:", data);
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Check if we have valid questions
        if (!data.ai_generated_questions || !data.ai_generated_questions.questions) {
          console.error("Invalid questions data structure:", data);
          throw new Error("Received invalid question data format");
        }
        
        // Set the questions
        setQuestions(data.ai_generated_questions.questions);
        
        // Set input data from the response
        if (data.input_data) {
          setTopic(data.input_data.topic || "");
          setNumberOfQuestions(data.input_data.numberOfQuestions || 5);
          setComplexity(data.input_data.complexity || "KS3");
          setSelectedLevels(data.input_data.levels || []);
          // Make sure the form is valid for approved content
          setIsChecked(true);
        }
        
        // Set the saved response ID for sharing functionality
        setSavedResponseId(approvedId);
        
        toast.success("Approved questions loaded successfully!");
      } catch (error) {
        console.error("Error fetching approved questions:", error);
        setError({
          message: "Failed to load approved questions",
          details: error instanceof Error ? error.message : "Unknown error"
        });
        toast.error("Failed to load approved questions");
      } finally {
        setLoading(false);
      }
    };

    const searchParams = new URLSearchParams(window.location.search);
    const approvedId = searchParams.get('approved');

    if (approvedId) {
      fetchApprovedQuestions(approvedId);
    }
  }, []);

  // Handlers
  const handleLevelChange = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      toast(`Selected file: ${file.name}`);
    }
  };

  const handleInputTypeChange = (value: "topic" | "file") => {
    setInputType(value);
    // Clear the other input type when switching
    if (value === "topic") {
      setSelectedFile(null);
    } else {
      setTopic("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Skip premium/usage check for approved content
    if (!isApprovedContent) {
      // Early premium/usage check
      try {
        const res = await fetch("/api/check-premium", {
          method: "GET",
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const data = await res.json();
        if (!data.premium && data.usageExceeded) {
          setShowSubscriptionDialog(true);
          return;
        }
      } catch (err) {
        console.error("Error checking premium status:", err);
      }
    }

    setLoading(true);
    setError(null);
    setQuestions(null);
    
    // Don't reset the savedResponseId if we're using approved content
    if (!isApprovedContent) {
      setSavedResponseId(null);
    }

    const formData = new FormData();
    if (inputType === "file" && selectedFile) {
      formData.append("file", selectedFile);
    }

    const config = {
      topic: inputType === "topic" ? topic : "",
      levels: selectedLevels.length > 0 ? selectedLevels : ["Remembering", "Understanding"],  // Default levels for approved content
      numberOfQuestions,
      complexity,
    };

    formData.append("config", JSON.stringify(config));

    try {
      // Add the approved flag to the URL if this is approved content
      const url = isApprovedContent 
        ? "/api/tools/long-qa-generator?approved=true" 
        : "/api/tools/long-qa-generator";
        
      const response = await axios.post<ApiResponse>(
        url,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (!response?.data?.data) {
        throw new Error("Failed to generate questions");
      }

      setQuestions(response.data.data.ai_generated_questions.questions);
      
      // Only update the ID if we're not using approved content
      if (!isApprovedContent) {
        setSavedResponseId(response.data.data.id);
      }
      
      toast.success("Questions generated successfully!");
    } catch (err: any) {
      const errorData = err.response?.data || {};
      setError({
        message: errorData.error || "Failed to generate questions",
        details: errorData.details,
      });
      toast.error(errorData.error || "Failed to generate questions");
    } finally {
      setLoading(false);
      setIsChecked(true);
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    setError(null);
    setQuestions(null);

    const formData = new FormData();
    if (inputType === "file" && selectedFile) {
      formData.append("file", selectedFile);
    }

    const config = {
      topic: inputType === "topic" ? topic : "",
      levels: selectedLevels.length > 0 ? selectedLevels : ["Remembering", "Understanding"],  // Default levels for approved content
      numberOfQuestions,
      complexity,
    };

    formData.append("config", JSON.stringify(config));

    try {
      // Add the approved flag to the URL if this is approved content
      const url = isApprovedContent 
        ? "/api/tools/long-qa-generator?approved=true" 
        : "/api/tools/long-qa-generator";
        
      const { data: apiResponse } = await axios.post<ApiResponse>(
        url,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (!apiResponse?.data) {
        throw new Error("Failed to generate questions");
      }

      setQuestions(apiResponse.data.ai_generated_questions.questions);
      
      // Only update the ID if we're not using approved content
      if (!isApprovedContent) {
        setSavedResponseId(apiResponse.data.id);
      }
      
      toast.success("Questions regenerated successfully!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError({
        message: errorMessage,
        details: {
          status: 'error',
          contentFlags: undefined
        }
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setIsChecked(true);
    }
  };

  // Export functions
  const downloadAsTxt = () => {
    if (!questions) return;

    const content = questions
      .map(
        (q) =>
          `Level: ${q.level}\nQuestion: ${q.question}\nExample Response: ${q.exampleResponse}\n\n`
      )
      .join("");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsCsv = () => {
    if (!questions) return;

    const headers = ["Level", "Question", "Example Response"];
    const rows = questions.map((q) => [q.level, q.question, q.exampleResponse]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsWord = async () => {
    if (!questions) return;

    try {
      // Load the watermark image
      const imageUrl = "/mainlogo.png";
      const response = await fetch(imageUrl);
      const imageBuffer = await response.arrayBuffer();

      // Create a new document with a watermark in the header
      const doc = new Document({
        sections: [
          {
            headers: {
              default: new Header({
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: imageBuffer,
                        transformation: { width: 50, height: 50 }, // Small watermark size
                        type: 'png',
                      }),
                    ],
                    alignment: "right", // Align watermark to the right
                  }),
                ],
              }),
            },
            children: questions.flatMap((q) => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Level: ${q.level}`,
                    bold: true,
                    size: 28,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Question:",
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: q.question,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Example Response:",
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: q.exampleResponse,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [new TextRun({ text: "" })], // Empty paragraph for spacing
              }),
            ]),
          },
        ],
      });

      // Generate the document
      const blob = await Packer.toBlob(doc);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "questions.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Word document downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download Word document");
      console.error("Error generating Word document:", error);
    }
  };


  const renderContent = (content: string) => {
    if (content.includes("```")) {
      return (
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
          components={{
            code({ node, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';

              if (className && language) {
                return (
                  <div className="relative">
                    <div className="absolute top-2 right-2 text-xs text-gray-500">
                      {language}
                    </div>
                    <pre className="bg-[#1e1e1e] text-white p-4 rounded-lg overflow-x-auto">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                );
              }
              return <code className={className} {...props}>{children}</code>;
            }
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }
    return <p className="text-gray-700 whitespace-pre-line">{content}</p>;
  };

  const isFormValid = () => {
    // If it's approved content, always allow form submission
    if (isApprovedContent) return true;
    
    if (inputType === "topic" && !topic) return false;
    if (inputType === "file" && !selectedFile) return false;
    if (selectedLevels.length === 0) return false;
    if (!isChecked) return false;
    return true;
  };

  return (
    <main className='container mx-auto px-4 py-8'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='flex justify-end mb-4'>
        <ReportButton toolType='long_qa' position='inline' variant='pre' />
      </div>
      <div className='text-center mb-12'>
        <h1 className='text-4xl font-bold text-gray-900 mb-4'>
          Bloom's Taxonomy Question Generator
        </h1>
        <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
          Generate well-structured questions and answers
        </p>
      </div>

      <div className='grid md:grid-cols-2 gap-8'>
        <div className='space-y-6'>
          <Card className='p-6'>
            <form onSubmit={handleSubmit} className='space-y-6'>
              <div className="mb-4">
                <label className='block text-sm font-medium mb-2'>
                  Select Input Method
                </label>
                <RadioGroup
                  value={inputType}
                  onValueChange={(value) => handleInputTypeChange(value as "topic" | "file")}
                  className="flex flex-col space-y-2"
                  disabled={isApprovedContent}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="topic" id="option-topic" disabled={isApprovedContent} />
                    <label htmlFor="option-topic" className={`cursor-pointer ${isApprovedContent ? 'opacity-50' : ''}`}>Enter Topic</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="file" id="option-file" disabled={isApprovedContent} />
                    <label htmlFor="option-file" className={`cursor-pointer ${isApprovedContent ? 'opacity-50' : ''}`}>Upload Document</label>
                  </div>
                </RadioGroup>
              </div>

              {inputType === "file" && (
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Upload Document
                  </label>
                  <div className='flex items-center space-x-2'>
                    <input
                      type='file'
                      onChange={handleFileChange}
                      accept='.doc,.docx,.pdf,.txt'
                      className='w-full'
                      id='file-upload'
                      disabled={isApprovedContent}
                    />
                    {selectedFile && (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => setSelectedFile(null)}
                        className='shrink-0'
                        disabled={isApprovedContent}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {inputType === "topic" && (
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Topic or Concept
                  </label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className={`w-full p-2 border rounded-md min-h-[100px] ${isApprovedContent ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="Enter your topic here..."
                    disabled={isApprovedContent}
                  />
                </div>
              )}

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Questions per Level
                  </label>
                  <select
                    value={numberOfQuestions}
                    onChange={(e) =>
                      setNumberOfQuestions(Number(e.target.value))
                    }
                    className={`w-full p-2 border rounded-md ${isApprovedContent ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    disabled={isApprovedContent}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium mb-2'>
                    Complexity Level
                  </label>
                  <select
                    value={complexity}
                    onChange={(e) =>
                      setComplexity(
                        e.target.value as "KS3" | "KS4" | "Advanced"
                      )
                    }
                    className={`w-full p-2 border rounded-md ${isApprovedContent ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    disabled={isApprovedContent}
                  >
                    <option value='KS3'>Key Stage 3</option>
                    <option value='KS4'>Key Stage 4</option>
                    <option value='Advanced'>Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>
                  Select Bloom's Taxonomy Levels
                </label>
                <div className='grid grid-cols-2 gap-2'>
                  {bloomLevels.map((level) => (
                    <label
                      key={level}
                      className={`flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 cursor-pointer ${isApprovedContent ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Checkbox
                        checked={selectedLevels.includes(level)}
                        onCheckedChange={() => handleLevelChange(level)}
                        disabled={isApprovedContent}
                      />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className='flex items-center space-x-4'>
                <Checkbox
                  id='verification'
                  checked={isChecked}
                  onCheckedChange={() => setIsChecked(!isChecked)}
                  className='border-purple-400 data-[state=checked]:bg-purple-400'
                  disabled={isApprovedContent}
                />
                <label
                  htmlFor='verification'
                  className={`text-sm text-purple-400 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${isApprovedContent ? 'opacity-50' : ''}`}
                >
                  I verify that I have not used any personal data such as
                  student names or private information. Instead of names, I have
                  referred to them as student, pupil or similar.
                </label>
              </div>

              <Button
                type='submit'
                disabled={!isFormValid() || loading}
                className='w-full'
              >
                {loading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating...
                  </>
                ) : (
                  "Generate Questions"
                )}
              </Button>
            </form>
          </Card>
        </div>

        <div className='space-y-6'>
          {questions === null && !loading && !error && (
            <Card className='p-6 text-center text-gray-500'>
              Generate questions to see results here
            </Card>
          )}

          {error && (
            <Card className='p-6 border-red-50 bg-red-50'>
              <div className='space-y-2'>
                <p className='font-sm text-red-500'>{error.message}</p>
                {error.details && (
                  <div className='mt-2'>
                    <p className='text-sm text-gray-600'>
                      Status: {typeof error.details === 'string' ? error.details : (error.details.status || 'Unknown')}
                    </p>
                    {typeof error.details === 'object' && error.details.contentFlags && (
                      <div className='mt-2'>
                        <p className='text-sm font-medium'>Content Flags:</p>
                        <ul className='list-disc pl-5 text-sm text-gray-600'>
                          {Object.entries(error.details.contentFlags)
                            .filter(([_, value]) => value)
                            .map(([key]) => (
                              <li key={key}>{key.replace(/_/g, ' ')}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {loading && (
            <Card className='p-6 text-center'>
              <Loader2 className='h-8 w-8 animate-spin mx-auto mb-4' />
              <p>Generating questions...</p>
            </Card>
          )}

          {questions && questions.length > 0 && (
            <>
              <div className='flex gap-4 justify-end items-center flex-wrap'>
                <div className='flex space-x-3'>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => {
                            const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tools/long-qa-generator/${savedResponseId}/view`;
                            navigator.clipboard.writeText(shareUrl);
                            toast.success("Share link copied to clipboard");
                          }}
                          variant='outline'
                          size='icon'
                          className='w-9 h-9'
                        >
                          <Share2 className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy share link</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/tools/long-qa-generator/${savedResponseId}/view`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "icon",
                            className: "w-9 h-9",
                          })}
                        >
                          <Eye className='h-4 w-4' />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View questions</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/tools/long-qa-generator/${savedResponseId}/edit`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "icon",
                            className: "w-9 h-9",
                          })}
                        >
                          <Edit className='h-4 w-4' />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit questions</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='outline'
                      className='flex items-center gap-2'
                    >
                      <Download className='h-4 w-4' />
                      Export
                      <ChevronDown className='h-4 w-4 ml-1 opacity-50' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-[200px]'>
                    <DropdownMenuItem
                      onClick={downloadAsTxt}
                      className='cursor-pointer'
                    >
                      <FileText className='h-4 w-4 mr-2' />
                      Export Text
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={downloadAsCsv}
                      className='cursor-pointer'
                    >
                      <FileSpreadsheet className='h-4 w-4 mr-2' />
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={downloadAsWord}
                      className='cursor-pointer'
                    >
                      <FileText className='h-4 w-4 mr-2' />
                      Export Word
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  onClick={handleRegenerate}
                  variant='outline'
                  className='flex items-center gap-2'
                  disabled={loading}
                >
                  <RefreshCw className='h-4 w-4' />
                  Regenerate
                </Button>

                {savedResponseId && (
                  <ReportButton
                    toolType='long_qa'
                    resultId={savedResponseId}
                    position='inline'
                  />
                )}
              </div>

              <div className='space-y-4'>
                {questions.map((question: any, idx: number) => (
                  <Card key={idx} className="p-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg">Question {idx + 1}</h3>
                        <p className="text-sm text-gray-500">{question.level}</p>
                      </div>

                      <div className="space-y-4">
                        {renderContent(question.question)}

                        <div>
                          <h4 className="font-medium mb-2">Example Response:</h4>
                          {renderContent(question.exampleResponse)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}