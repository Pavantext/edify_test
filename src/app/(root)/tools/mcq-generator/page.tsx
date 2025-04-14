"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { ReportButton } from "@/components/ReportButton";
import { Textarea } from "@/components/ui/textarea";
import { Document, Packer, Paragraph, TextRun, Header, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { ExportDropdown } from "@/components/ExportDropdown";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "@/utils/supabase/client";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import SubscriptionDialog from "@/components/SubscriptionDialog";

const taxonomyLevels = [
  { id: "remembering", label: "Remembering" },
  { id: "understanding", label: "Understanding" },
  { id: "applying", label: "Applying" },
  { id: "analysing", label: "Analysing" },
  { id: "evaluating", label: "Evaluating" },
  { id: "creating", label: "Creating" },
];

export default function MCQGenerator() {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const [questionCount, setQuestionCount] = useState(5);
  const [mcqResponse, setMCQResponse] = useState<any>(null);
  const [error, setError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(
    null
  );
  const [editedQuestion, setEditedQuestion] = useState<any>(null);
  const [formRef, setFormRef] = useState<HTMLFormElement | null>(null);

  const [inputMethod, setInputMethod] = useState("text"); // "text" or "file"
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<any>("");
  const [uploadError, setUploadError] = useState("");
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [topicValue, setTopicValue] = useState("");

  // Moderation related states
  const [hasApprovedId, setHasApprovedId] = useState(false);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [approvedData, setApprovedData] = useState<any>(null);

  // Check for approved ID in URL on component mount
  useEffect(() => {
    const checkApprovedId = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('approved');

      if (id) {
        setIsLoading(true);
        setApprovedId(id);
        setHasApprovedId(true);

        try {
          // Fetch the approved data
          const response = await fetch(`/api/tools/mcq-generator?approved=${id}`);
          const data = await response.json();

          if (response.ok && data) {
            setApprovedData(data);

            // Prefill form fields from approved data
            if (data.input_data) {
              // Set input method
              setInputMethod(data.input_data.inputMethod || 'text');

              // Set topic
              if (data.input_data.topic) {
                setTopicValue(data.input_data.topic);
              }

              // Set taxonomy levels
              if (data.input_data.taxonomyLevels && Array.isArray(data.input_data.taxonomyLevels)) {
                setSelectedLevels(data.input_data.taxonomyLevels);
              }

              // Set question count
              if (data.input_data.questionCount) {
                setQuestionCount(data.input_data.questionCount);
              }

              // Set file URL if available
              if (data.input_data.fileUrl) {
                setUploadedFileUrl(data.input_data.fileUrl);
              }

              // We don't pre-populate MCQResponse to avoid issues with missing data
              // Questions will be generated fresh when the user submits the form
            }
          } else {
            setError(data.error || 'Failed to load approved data');
          }
        } catch (err) {
          console.error('Error fetching approved data:', err);
          setError('Failed to load approved data');
        } finally {
          setIsLoading(false);
        }
      }
    };

    checkApprovedId();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Word document");
      return;
    }

    setUploadLoading(true);
    setUploadError("");

    try {
      // Generate a unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split(".").pop();
      const fileName = `${timestamp}.${fileExt}`;
      const filePath = `mcq-uploads/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);

      setUploadedFileUrl(publicUrl);
      toast.success("File uploaded successfully");
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Failed to upload file");
      toast.error("Failed to upload file");
    } finally {
      setIsChecked(!isChecked);
      setUploadLoading(false);
    }
  };

  const generateMCQ = async (data: any) => {
    try {
      const response = await fetch(`/api/tools/mcq-generator${approvedId ? `?approved=${approvedId}` : ''}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fileUrl: uploadedFileUrl, // Send the uploaded file URL to backend
          inputMethod: inputMethod,
          questionCount: Number(data.questionCount),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.data;
    } catch (err) {
      throw err;
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

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

    setIsLoading(true);
    setError("");
    setMCQResponse(null);

    const formData = new FormData(e.target);

    // Use prefilled values from approved content if available
    const data = {
      topic: hasApprovedId ? topicValue : formData.get("topic"),
      taxonomyLevels: selectedLevels,
      answersPerQuestion: Number(formData.get("answerCount") || 4),
      difficulty: formData.get("difficulty") || "medium",
      questionCount: Number(formData.get("questionCount")),
      inputMethod: hasApprovedId ? inputMethod : inputMethod,
      fileUrl: uploadedFileUrl,
      approvedId: approvedId,
    };

    // Skip validation for locked fields when coming from approved URL
    if (
      !hasApprovedId && (
        (!data.topic && inputMethod === "text") ||
        selectedLevels.length === 0
      )
    ) {
      setError("Please fill in all required fields");
      setIsLoading(false);
      return;
    }

    try {
      const result = await generateMCQ(data);
      setMCQResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate MCQs");
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side only shuffle function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleSaveEdit = async (questionIndex: number) => {
    const updatedQuestions = [...mcqResponse.questions_data];
    updatedQuestions[questionIndex] = editedQuestion;

    // Update explanation based on the new correct answer
    const correctAnswer = editedQuestion.answers.find((a: any) => a.isCorrect);
    if (correctAnswer) {
      editedQuestion.explanation = `The correct answer is: ${correctAnswer.text}. ${correctAnswer.explanation}`;
    }

    setMCQResponse({ ...mcqResponse, questions_data: updatedQuestions });
    setEditingQuestionId(null);
    setEditedQuestion(null);
  };

  const exportToWord = async () => {
    if (!mcqResponse?.questions_data) return;

    try {
      // Load the watermark image
      const imageUrl = "/mainlogo.png";
      const response = await fetch(imageUrl);
      const imageBuffer = await response.arrayBuffer();

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
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `MCQ Questions - ${mcqResponse.topic}`,
                    bold: true,
                    size: 32,
                  }),
                ],
              }),
              ...mcqResponse.questions_data.flatMap((q: any, i: number) => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `\nQuestion ${i + 1}: ${q.text}`,
                      bold: true,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Taxonomy Level: ${q.taxonomyLevel}`,
                      italics: true,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "\nCorrect Answer:",
                      bold: true,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: q.answers.find((a: any) => a.isCorrect)?.text || "",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "\nDistractors:",
                      bold: true,
                    }),
                  ],
                }),
                ...q.answers
                  .filter((a: any) => !a.isCorrect)
                  .map(
                    (a: any, j: number) =>
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `${j + 1}. ${a.text}`,
                          }),
                        ],
                      })
                  ),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `\nExplanation: ${q.explanation}`,
                      color: "666666",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "\n----------------------------------------\n",
                    }),
                  ],
                }),
              ]),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, "mcq-questions.docx");

      toast.success("Word document downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download Word document");
      console.error("Error generating Word document:", error);
    }
  };


  const handleRegenerateQuestion = async (questionIndex: number) => {
    setIsLoading(true);

    try {
      // Get current form data
      const data = {
        topic: inputMethod === "text" ? mcqResponse.topic : null,
        taxonomyLevels: selectedLevels,
        answersPerQuestion: mcqResponse.questions_data[0].answers.length,
        difficulty: mcqResponse.difficulty,
        questionCount: questionCount,
        inputMethod: inputMethod,
        fileUrl: uploadedFileUrl,
      };

      // Generate completely new set of questions
      const result = await generateMCQ(data);
      setMCQResponse(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate questions"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelToggle = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const handleEditQuestion = (questionIndex: number) => {
    setEditingQuestionId(questionIndex);
    setEditedQuestion(mcqResponse.questions_data[questionIndex]);
  };

  const exportOptions = [
    {
      label: "Export CSV",
      value: "csv",
      onClick: () => exportQuestions("csv"),
    },
    {
      label: "Export TXT",
      value: "txt",
      onClick: () => exportQuestions("txt"),
    },
    {
      label: "Export Word",
      value: "word",
      onClick: exportToWord,
    },
  ];

  const exportQuestions = (format: "csv" | "txt") => {
    if (!mcqResponse?.questions_data) return;

    let content = "";
    if (format === "csv") {
      // For CSV, we'll create separate columns for each distractor
      const maxDistractors = Math.max(
        ...mcqResponse.questions_data.map(
          (q: any) => q.answers.filter((a: any) => !a.isCorrect).length
        )
      );

      // Create headers with numbered distractors
      content =
        "Question,Correct Answer," +
        Array.from(
          { length: maxDistractors },
          (_, i) => `Distractor ${i + 1}`
        ).join(",") +
        ",Taxonomy Level,Explanation\n";

      mcqResponse.questions_data.forEach((q: any) => {
        const correctAnswer =
          q.answers.find((a: any) => a.isCorrect)?.text || "";
        const distractors = q.answers
          .filter((a: any) => !a.isCorrect)
          .map((a: any) => a.text);

        // Pad distractors array if needed
        while (distractors.length < maxDistractors) {
          distractors.push("");
        }

        content += `"${q.text}","${correctAnswer}",${distractors
          .map((d: string) => `"${d}"`)
          .join(",")},"${q.taxonomyLevel}","${q.explanation}"\n`;
      });
    } else {
      mcqResponse.questions_data.forEach((q: any, i: number) => {
        content += `Question ${i + 1}: ${q.text}\n`;
        content += `Taxonomy Level: ${q.taxonomyLevel}\n\n`;
        content += "Answers:\n";
        // First list the correct answer
        const correctAnswer = q.answers.find((a: any) => a.isCorrect);
        content += `Correct Answer: ${correctAnswer?.text}\n\n`;
        // Then list distractors separately
        content += "Distractors:\n";
        q.answers
          .filter((a: any) => !a.isCorrect)
          .forEach((a: any, j: number) => {
            content += `${j + 1}. ${a.text}\n`;
          });
        content += `\nExplanation: ${q.explanation}\n`;
        content += "\n----------------------------------------\n\n";
      });
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcq-questions.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderContent = (content: string) => {
    // Check if content contains code blocks
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

    // If no code blocks, render as plain text
    return <p className="text-gray-700 whitespace-pre-line">{content}</p>;
  };

  return (
    <div className='min-h-screen bg-white py-12'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4'>
        {/* Report button in corner */}
        <div className='flex justify-end mb-4'>
          <ReportButton toolType='mcq' position='inline' variant='pre' />
        </div>

        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            MCQ Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Create multiple-choice questions with varying complexity levels
          </p>
        </div>

        <div className='grid gap-8 lg:grid-cols-2 max-w-7xl mx-auto'>
          {/* Form Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <form
              onSubmit={handleSubmit}
              className='space-y-6'
              ref={(ref) => setFormRef(ref)}
            >
              {/* Input Method Selection */}
              <div className='space-y-2'>
                <Label>Input Method</Label>
                <RadioGroup
                  defaultValue='text'
                  value={inputMethod}
                  onValueChange={setInputMethod}
                  className='flex space-x-4'
                  disabled={hasApprovedId}
                >
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='text' id='text' disabled={hasApprovedId} />
                    <Label htmlFor='text' className={hasApprovedId ? 'opacity-70' : ''}>Enter Text</Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='file' id='file' disabled={hasApprovedId} />
                    <Label htmlFor='file' className={hasApprovedId ? 'opacity-70' : ''}>Upload Document</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Conditional Input Based on Selection */}
              {inputMethod === "text" ? (
                <div className='space-y-2'>
                  <Label htmlFor='topic'>Topic or Concept</Label>
                  <Textarea
                    id='topic'
                    name='topic'
                    required
                    placeholder='Enter the topic or paste your text here...'
                    className='min-h-[100px]'
                    disabled={hasApprovedId}
                    readOnly={hasApprovedId}
                    value={topicValue}
                    onChange={(e) => setTopicValue(e.target.value)}
                  />
                </div>
              ) : (
                <div className='space-y-2'>
                  <Label htmlFor='file'>Upload Document (PDF or Word)</Label>
                  <div className='flex items-center gap-4'>
                    <Input
                      id='file'
                      type='file'
                      accept='.pdf,.doc,.docx'
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          handleFileUpload(file);
                        }
                      }}
                      className='flex-1'
                      disabled={hasApprovedId}
                    />
                    {uploadLoading && (
                      <Loader2 className='w-4 h-4 animate-spin text-gray-500' />
                    )}
                    {uploadedFileUrl && (
                      <div className='text-sm text-green-600'>
                        ✓ File uploaded
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className='space-y-2'>
                <Label>Bloom's Taxonomy Levels</Label>
                <div className='grid grid-cols-2 gap-4'>
                  {taxonomyLevels.map((level) => (
                    <div key={level.id} className='flex items-center space-x-2'>
                      <Checkbox
                        id={level.id}
                        checked={selectedLevels.includes(level.id)}
                        onCheckedChange={() => !hasApprovedId && handleLevelToggle(level.id)}
                        disabled={hasApprovedId}
                      />
                      <Label htmlFor={level.id} className={hasApprovedId ? 'opacity-70' : ''}>
                        {level.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='questionCount'>Number of Questions</Label>
                <Input
                  id='questionCount'
                  name='questionCount'
                  type='number'
                  min='1'
                  max='20'
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className='w-full'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='answerCount'>Answers per Question</Label>
                <Select name='answerCount' defaultValue='4'>
                  <SelectTrigger>
                    <SelectValue placeholder='Select number of answers' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='3'>3 answers</SelectItem>
                    <SelectItem value='4'>4 answers</SelectItem>
                    <SelectItem value='5'>5 answers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='difficulty'>Difficulty Level</Label>
                <Select name='difficulty' defaultValue='medium'>
                  <SelectTrigger>
                    <SelectValue placeholder='Select difficulty' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='easy'>Easy</SelectItem>
                    <SelectItem value='medium'>Medium</SelectItem>
                    <SelectItem value='hard'>Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasApprovedId && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800 text-sm">
                  <p className="font-medium">Some fields are locked based on approved content</p>
                  <p>You can still adjust other settings like number of questions, difficulty level, and answers per question.</p>
                </div>
              )}

              <div className='flex items-center space-x-4'>
                <Checkbox
                  id='verification'
                  checked={isChecked}
                  onCheckedChange={() => setIsChecked(!isChecked)}
                  className='border-purple-400 data-[state=checked]:bg-purple-400'
                />
                <label
                  htmlFor='verification'
                  className='text-sm text-purple-400 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                >
                  I verify that I have not used any personal data such as
                  student names or private information. Instead of names, I have
                  referred to them as student, pupil or similar.
                </label>
              </div>

              <Button
                type='submit'
                disabled={
                  !isChecked ||
                  isLoading ||
                  selectedLevels.length === 0 ||
                  (inputMethod === "file" && !uploadedFileUrl)
                }
                className='w-full'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating...
                  </>
                ) : (
                  "Generate MCQs"
                )}
              </Button>
            </form>
          </Card>
          {/* Results Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <div className='flex flex-col justify-between items-center mb-2'>
              <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
                {mcqResponse && mcqResponse.questions_data && mcqResponse.questions_data.length > 0 && (
                  <>
                    <Button
                      variant='outline'
                      onClick={() => handleRegenerateQuestion(0)}
                      disabled={isLoading}
                      className='flex items-center gap-2 w-full'
                    >
                      <RefreshCw className='w-4 h-4' />
                      Regenerate
                    </Button>
                    <ExportDropdown options={exportOptions} />
                  </>
                )}
              </div>

              {error && (
                <div className='bg-red-50 text-red-600 p-4 rounded-lg w-full mb-4'>
                  {error}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className='animate-pulse space-y-4'>
                <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                <div className='h-4 bg-gray-200 rounded w-full'></div>
                <div className='h-4 bg-gray-200 rounded w-5/6'></div>
              </div>
            ) : mcqResponse?.questions_data && mcqResponse.questions_data.length > 0 ? (
              <div className='space-y-6'>
                <div className='text-sm text-gray-500 mt-4'>
                  <p>Topic: {mcqResponse.topic}</p>
                  <p>Difficulty: {mcqResponse.difficulty}</p>
                  <p>
                    Generated questions: {mcqResponse.questions_data.length}
                  </p>
                </div>
                {mcqResponse.questions_data.map((question: any, idx: number) => (
                  <Card key={idx} className='p-6'>
                    {editingQuestionId === idx ? (
                      <div className='space-y-4'>
                        <div>
                          <Label>Question Text</Label>
                          <Textarea
                            value={editedQuestion.text}
                            onChange={(e) =>
                              setEditedQuestion({
                                ...editedQuestion,
                                text: e.target.value,
                              })
                            }
                            className='w-full mt-2'
                          />
                        </div>

                        <div className='space-y-4'>
                          <Label>Answers</Label>
                          {editedQuestion.answers.map(
                            (answer: any, ansIdx: number) => (
                              <div
                                key={ansIdx}
                                className='space-y-2 p-4 bg-gray-50 rounded-lg'
                              >
                                <Input
                                  value={answer.text}
                                  onChange={(e) => {
                                    const newAnswers = [
                                      ...editedQuestion.answers,
                                    ];
                                    newAnswers[ansIdx] = {
                                      ...answer,
                                      text: e.target.value,
                                    };
                                    setEditedQuestion({
                                      ...editedQuestion,
                                      answers: newAnswers,
                                    });
                                  }}
                                  className='w-full'
                                />
                                <div className='flex items-center space-x-2'>
                                  <Checkbox
                                    checked={answer.isCorrect}
                                    onCheckedChange={(checked) => {
                                      const newAnswers = [
                                        ...editedQuestion.answers,
                                      ].map((a, i) => ({
                                        ...a,
                                        isCorrect:
                                          i === ansIdx ? checked : false,
                                      }));
                                      setEditedQuestion({
                                        ...editedQuestion,
                                        answers: newAnswers,
                                      });
                                    }}
                                  />
                                  <Label>Mark as correct answer</Label>
                                </div>
                                {answer.explanation && (
                                  <div>
                                    <Label>Explanation</Label>
                                    <Textarea
                                      value={answer.explanation}
                                      onChange={(e) => {
                                        const newAnswers = [
                                          ...editedQuestion.answers,
                                        ];
                                        newAnswers[ansIdx] = {
                                          ...answer,
                                          explanation: e.target.value,
                                        };
                                        setEditedQuestion({
                                          ...editedQuestion,
                                          answers: newAnswers,
                                        });
                                      }}
                                      className='w-full mt-2'
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          )}
                        </div>

                        <div className='flex gap-2'>
                          <Button onClick={() => handleSaveEdit(idx)}>
                            Save Changes
                          </Button>
                          <Button
                            variant='outline'
                            onClick={() => {
                              setEditingQuestionId(null);
                              setEditedQuestion(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className='flex justify-between items-start mb-4'>
                          <div>
                            <h3 className='text-lg font-semibold'>
                              Question {idx + 1}
                            </h3>
                            <span className='text-sm text-gray-500'>
                              {question.taxonomyLevel}
                            </span>
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => handleEditQuestion(idx)}
                              className='flex items-center gap-2'
                            >
                              <span className='w-4 h-4'>✏️</span>
                              Edit
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {renderContent(question.text)}

                          <div className="space-y-2">
                            {question.answers.map((answer: any, ansIdx: number) => (
                              <div
                                key={ansIdx}
                                className={cn(
                                  "p-3 rounded-lg",
                                  answer.isCorrect ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"
                                )}
                              >
                                {renderContent(answer.text)}
                                {answer.isCorrect && answer.explanation && (
                                  <div className="mt-2 text-sm text-green-600">
                                    {renderContent(answer.explanation)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <p className='text-center text-gray-500'>
                Your generated questions will appear here
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
