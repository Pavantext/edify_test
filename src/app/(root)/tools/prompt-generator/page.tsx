"use client";
import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Star, Eye, Edit, Share2 } from "lucide-react";
import type { PromptGeneratorResponse } from "@/schemas/prompt-schema";
import PromptActions from "@/components/prompt-actions";
import { ReportButton } from "@/components/ReportButton";
import axios from "axios";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { saveAs } from "file-saver";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SubscriptionDialog from "@/components/SubscriptionDialog";

const StarRating = ({
  rating,
  onRate,
  disabled,
}: {
  rating: number;
  onRate: (rating: number) => void;
  disabled: boolean;
}) => {
  return (
    <div className='flex items-center space-x-1'>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRate(star)}
          disabled={disabled}
          aria-label={`Rate ${star} stars`}
          className={`focus:outline-none ${disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:scale-110 transition-transform"
            }`}
        >
          <Star
            className={`h-5 w-5 ${star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
              }`}
          />
        </button>
      ))}
    </div>
  );
};

export default function PromptGeneratorPage() {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [promptResponse, setPromptResponse] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [promptResponseId, setPromptResponseId] = useState(null);
  const [ratings, setRatings] = useState<{ [key: number]: number; }>({});
  const [ratingLoading, setRatingLoading] = useState<{
    [key: number]: boolean;
  }>({});
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [savedPromptId, setSavedPromptId] = useState<string | null>(null);

  const focusAreaOptions = [
    "Ethical Analysis",
    "Creativity",
    "Critical Thinking",
    "Problem Solving",
    "Adaptability",
    "Communication",
    "Research Skills",
    "Decision Making",
  ];

  useEffect(() => {
    const fetchApprovedPrompt = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      if (approvedId) {
        setIsLoading(true);
        try {
          console.log("Fetching approved prompt with ID:", approvedId);
          const response = await fetch(`/api/tools/prompt-generator?approved=${approvedId}`);
          const data = await response.json();
          console.log("API Response:", data);

          if (!response.ok) {
            if (response.status === 403) {
              setError(`Content not approved: ${data.details?.status || 'Unknown status'}`);
              return;
            }
            throw new Error(data.error || 'Failed to fetch prompt data');
          }

          if (!data || !data.input_data) {
            console.error("Invalid API response format:", data);
            throw new Error('Invalid response format');
          }

          // Make sure refinedPrompts is always an array
          const refinedPrompts = Array.isArray(data.refinedPrompts)
            ? data.refinedPrompts
            : (data.refinedPrompts ? [data.refinedPrompts] : []);

          console.log("Processed refinedPrompts:", refinedPrompts);

          setPromptResponse({
            originalPrompt: data.input_data.originalPrompt,
            refinedPrompts: refinedPrompts,
          });

          setSavedPromptId(approvedId);

          // Auto-check the verification checkbox when loading an approved prompt
          setIsChecked(true);

          if (data.input_data) {
            const form = formRef.current;
            if (form) {
              form.originalPrompt.value = data.input_data.originalPrompt || '';

              if (form.grade && data.input_data.grade) form.grade.value = data.input_data.grade;
              if (form.subject && data.input_data.subject) form.subject.value = data.input_data.subject;
              if (form.skillLevel && data.input_data.skillLevel) form.skillLevel.value = data.input_data.skillLevel;

              setCharCount(data.input_data.originalPrompt?.length || 0);

              if (data.input_data.focusAreas && Array.isArray(data.input_data.focusAreas)) {
                setSelectedFocusAreas(data.input_data.focusAreas);
              }
            }
          }
        } catch (err: any) {
          console.error('Error loading prompt data:', err);
          setError(err.message || 'Failed to load prompt data');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchApprovedPrompt();
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 500) {
      setCharCount(text.length);
    }
  };

  const handleExport = () => {
    if (!promptResponse || !promptResponse.refinedPrompts || !Array.isArray(promptResponse.refinedPrompts)) return;

    const content = `
  Original Prompt: ${promptResponse.originalPrompt}
  
  ${promptResponse.refinedPrompts
        .map(
          (prompt: any, index: number) => `
  Refined Version ${index + 1}:
  Prompt: ${prompt.promptText || "N/A"}
  
  Complexity Level: ${prompt?.explanation?.complexityLevel?.refinedLevel || "N/A"}
  Bloom's Level: ${prompt?.explanation?.complexityLevel?.bloomsLevel || "N/A"}
  
  Explanation: ${prompt?.explanation?.explanation || "N/A"}
  
  Focus Areas:
  ${prompt?.explanation?.focusAreas && Array.isArray(prompt.explanation.focusAreas)
              ? prompt.explanation.focusAreas.map((area: string) => `- ${area}`).join("\n")
              : "- N/A"}
  
  ${prompt.ratings
              ? `Ratings:
  Average Rating: ${prompt.ratings.averageRating
                ? prompt.ratings.averageRating.toFixed(1)
                : "N/A"
              }
  Total Ratings: ${prompt.ratings.totalRatings || "N/A"}`
              : ""
            }
  `
        )
        .join("\n")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "generated-prompts.txt");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    setPromptResponse(null);
    setPromptResponseId(null);
    setRatings({});
    setRatingLoading({});

    if (!formRef.current) {
      console.error("Form reference is null");
      return;
    }

    const formData = new FormData(formRef.current);
    let promptText = formData.get("originalPrompt") as string;

    // If we have a savedPromptId and the input is disabled, use the existing prompt response
    if (savedPromptId && promptResponse) {
      // Skip validation for the original prompt when using an approved ID
      promptText = promptResponse.originalPrompt;
    } else {
      // Only validate when not using an approved ID
      if (!promptText) {
        setError("Please enter an original prompt");
        setIsLoading(false);
        return;
      }

      if (promptText.length > 500) {
        setError("Prompt must not exceed 500 characters");
        setIsLoading(false);
        return;
      }
    }

    try {
      const payload = {
        originalPrompt: promptText,
        focusAreas:
          selectedFocusAreas.length > 0
            ? selectedFocusAreas
            : ["Critical Thinking"],
        grade: formData.get("grade") || null,
        subject: formData.get("subject") || null,
        skillLevel: formData.get("skillLevel") || null,
      };
      console.log("Sending payload:", payload);

      const response = await axios.post(
        `/api/tools/prompt-generator${savedPromptId ? `?approvedId=${savedPromptId}` : ''}`,
        payload
      );

      if (!response.data) throw new Error("No data received from server");

      setPromptResponseId(response.data.data.id);

      setPromptResponse({
        originalPrompt: response.data.data.input_original_prompt,
        refinedPrompts: response.data.data.ai_refined_prompts,
      });
    } catch (err) {
      console.error("Error:", err);
      if (axios.isAxiosError(err)) {
        const errorData = err.response?.data;
        if (errorData) {
          // Handle content violations and other structured error responses
          if (err.response?.status === 400) {
            setError(errorData.error || "Invalid request");
          } else {
            setError(
              errorData.details
                ? `${errorData.error}: ${typeof errorData.details === "string"
                  ? errorData.details
                  : Array.isArray(errorData.details)
                    ? errorData.details.map((d: any) => d.message).join(", ")
                    : JSON.stringify(errorData.details)
                }`
                : errorData.error ||
                "An error occurred while generating prompts"
            );
          }
        } else {
          setError("Failed to connect to the server");
        }
      } else {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      }
    } finally {
      setIsLoading(false);
      setIsChecked(!isChecked);
    }
  };

  const handleRate = async (promptIndex: number, rating: number) => {
    if (ratingLoading[promptIndex] || !promptResponseId) return;

    setRatingLoading((prev) => ({ ...prev, [promptIndex]: true }));

    try {
      const response = await axios.post("/api/tools/prompt-generator/rate", {
        promptId: promptResponseId,
        promptIndex,
        rating,
      });

      setRatings((prev) => ({ ...prev, [promptIndex]: rating }));

      if (promptResponse) {
        const updatedPrompts = [...promptResponse.refinedPrompts];
        updatedPrompts[promptIndex] = {
          ...updatedPrompts[promptIndex],
          ratings: response.data.ratings,
        };

        setPromptResponse({
          ...promptResponse,
          refinedPrompts: updatedPrompts,
        });
      }
    } catch (error) {
      console.error("Failed to rate prompt:", error);
      setError("Failed to submit rating");
    } finally {
      setRatingLoading((prev) => ({ ...prev, [promptIndex]: false }));
    }
  };

  return (
    <div className='min-h-screen bg-white'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4 py-12'>
        <div className='flex justify-end mb-4'>
          <ReportButton toolType='prompt' position='inline' variant='pre' />
        </div>
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Educational Prompt Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Generate differentiated educational prompts with various complexity
            levels
          </p>
        </div>

        <div className='grid gap-8 lg:grid-cols-2 max-w-7xl mx-auto'>
          {/* Form Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <form ref={formRef} onSubmit={handleSubmit} className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='originalPrompt'>Original Prompt</Label>
                <Textarea
                  id='originalPrompt'
                  name='originalPrompt'
                  required
                  placeholder='Enter your prompt...'
                  className='min-h-[100px]'
                  maxLength={500}
                  onChange={handleTextChange}
                  disabled={!!savedPromptId}
                  readOnly={!!savedPromptId}
                />
                <div className='text-sm text-gray-500 text-right'>
                  {charCount}/500 characters
                </div>
              </div>

              <div className='space-y-2'>
                <Label>Focus Areas (Optional)</Label>
                <div className='grid grid-cols-2 gap-2'>
                  {focusAreaOptions.map((area) => (
                    <div key={area} className='flex items-center space-x-2'>
                      <Checkbox
                        id={area}
                        checked={selectedFocusAreas.includes(area)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFocusAreas([
                              ...selectedFocusAreas,
                              area,
                            ]);
                          } else {
                            setSelectedFocusAreas(
                              selectedFocusAreas.filter((a) => a !== area)
                            );
                          }
                        }}
                        disabled={!!savedPromptId}
                      />
                      <label htmlFor={area} className='text-sm'>
                        {area}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* <div className='space-y-2'>
                <Label htmlFor='grade'>Grade Level (Optional)</Label>
                <Input id='grade' name='grade' placeholder='e.g., 9th Grade' />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='subject'>Subject (Optional)</Label>
                <Input
                  id='subject'
                  name='subject'
                  placeholder='e.g., Mathematics'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='skillLevel'>Skill Level</Label>
                <Select name='skillLevel' defaultValue='intermediate'>
                  <SelectTrigger>
                    <SelectValue placeholder='Select skill level' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='beginner'>Beginner</SelectItem>
                    <SelectItem value='intermediate'>Intermediate</SelectItem>
                    <SelectItem value='advanced'>Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div> */}

              <div className='flex items-center space-x-4'>
                <Checkbox
                  id='verification'
                  checked={isChecked}
                  onCheckedChange={() => setIsChecked(!isChecked)}
                  className='border-purple-400 data-[state=checked]:bg-purple-400'
                  disabled={!!savedPromptId}
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
                disabled={!isChecked || isLoading}
                className='w-full'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating...
                  </>
                ) : savedPromptId ? (
                  "Regenerate Prompts"
                ) : (
                  "Generate Prompts"
                )}
              </Button>
            </form>
          </Card>

          {/* Results Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <div className='flex justify-between items-center mb-6'>
              <h2 className='text-2xl font-bold text-gray-900'>
                Generated Prompts
              </h2>

              {promptResponse && (
                <div className='flex flex-col sm:flex-row gap-2 sm:space-x-2 items-start sm:items-center'>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      onClick={handleExport}
                      className='text-sm w-full sm:w-auto'
                      size='sm'
                    >
                      Download as Text
                    </Button>
                    {/* <Link
                      href={`/tools/prompt-generator/${promptResponseId}/view`}
                      className={buttonVariants({
                        size: "sm",
                        className: "text-sm w-full sm:w-auto",
                      })}
                    >
                      View
                    </Link> */}
                    {/* <Link
                      href={`/tools/prompt-generator/${promptResponseId}/edit`}
                      className={buttonVariants({
                        size: "sm",
                        className: "text-sm w-full sm:w-auto",
                      })}
                    >
                      Edit
                    </Link> */}
                  </div>

                  <ReportButton
                    toolType='prompt'
                    resultId={promptResponseId!}
                    position='inline'
                  />
                </div>
              )}
            </div>

            {error && (
              <div className='p-4 mb-4 text-sm text-red-500 bg-red-50 rounded-md border border-red-200'>
                <div className='flex items-start'>
                  <div className='flex-shrink-0'>
                    <svg
                      className='h-5 w-5 text-red-400'
                      viewBox='0 0 20 20'
                      fill='currentColor'
                    >
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <div className='ml-3'>
                    <p className='font-medium'>{error}</p>
                  </div>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className='animate-pulse space-y-4'>
                <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                <div className='h-4 bg-gray-200 rounded w-full'></div>
                <div className='h-4 bg-gray-200 rounded w-5/6'></div>
              </div>
            ) : promptResponse ? (
              <div className='space-y-8'>
                <div className='bg-white p-6 rounded-lg border border-gray-100'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                    Original Prompt
                  </h3>
                  <p className='text-gray-700'>
                    {promptResponse.originalPrompt}
                  </p>
                </div>

                {promptResponse.refinedPrompts && Array.isArray(promptResponse.refinedPrompts) && promptResponse.refinedPrompts.map(
                  (prompt: any, index: number) => (
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
                            {prompt?.explanation?.complexityLevel?.refinedLevel || "N/A"}
                          </span>
                          <span className='px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full'>
                            {prompt?.explanation?.complexityLevel?.bloomsLevel || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className='prose prose-sm max-w-none'>
                        <div className='mb-4'>
                          <p className='text-gray-800'>{prompt.promptText}</p>
                          <div className='mt-4'>
                            <PromptActions promptText={prompt.promptText} />
                          </div>
                        </div>

                        <div className='mt-4 space-y-2'>
                          <h4 className='font-medium text-gray-900'>
                            Explanation
                          </h4>
                          <p className='text-gray-700'>
                            {prompt?.explanation?.explanation || "N/A"}
                          </p>
                        </div>

                        <div className='mt-4'>
                          <h4 className='font-medium text-gray-900'>
                            Focus Areas
                          </h4>
                          <ul className='list-disc pl-5 space-y-1'>
                            {prompt?.explanation?.focusAreas && Array.isArray(prompt.explanation.focusAreas) && prompt.explanation.focusAreas.map(
                              (area: any, i: number) => (
                                <li key={i} className='text-gray-700'>
                                  {area}
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        <div className='mt-4 flex items-center justify-between'>
                          <StarRating
                            rating={ratings[index] || 0}
                            onRate={(rating) => handleRate(index, rating)}
                            disabled={ratingLoading[index]}
                          />

                          {/* {prompt.ratings && (
                            <div className="text-sm text-gray-500">
                              {prompt.ratings.averageRating && (
                                <span className="mr-4">
                                  Avg Rating:{" "}
                                  {prompt.ratings.averageRating.toFixed(1)}
                                </span>
                              )}
                              {prompt.ratings.totalRatings && (
                                <span>
                                  ({prompt.ratings.totalRatings} ratings)
                                </span>
                              )}
                            </div>
                          )} */}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {promptResponse && (
                  <div className='mb-4'>
                    <div className='flex space-x-3'>
                      <TooltipProvider>
                        {/* Share Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => {
                                const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tools/prompt-generator/${promptResponseId}/view`;
                                navigator.clipboard.writeText(shareUrl);
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

                        {/* View Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/tools/prompt-generator/${promptResponseId}/view`}
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
                            <p>View prompts</p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Edit Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/tools/prompt-generator/${promptResponseId}/edit`}
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
                            <p>Edit prompts</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className='text-center text-gray-500'>
                Your generated prompts will appear here
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
