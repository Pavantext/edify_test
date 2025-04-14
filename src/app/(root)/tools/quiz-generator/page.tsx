"use client";
import React, { useState, useRef, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import type { Quiz } from "@/schemas/quiz-schema";
import { ReportButton } from "@/components/ReportButton";
import SubscriptionDialog from "@/components/SubscriptionDialog";

const questionTypes = [
  { id: "multiple_choice", label: "Multiple Choice" },
  { id: "true_false", label: "True/False" },
  { id: "short_answer", label: "Short Answer" },
  { id: "fill_in_blanks", label: "Fill in the Blanks" },
];

const difficultyLevels = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const bloomsLevels = [
  { value: "remember", label: "Remember" },
  { value: "understand", label: "Understand" },
  { value: "apply", label: "Apply" },
  { value: "Analyse", label: "Analyse" },
  { value: "evaluate", label: "Evaluate" },
  { value: "create", label: "Create" },
];

export default function QuizGeneratorPage() {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quizResponse, setQuizResponse] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBloomsLevels, setSelectedBloomsLevels] = useState<string[]>(
    []
  );
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Added for moderation support
  const [hasApprovedId, setHasApprovedId] = useState(false);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [topicValue, setTopicValue] = useState("");
  const [subjectValue, setSubjectValue] = useState("");
  const [gradeLevelValue, setGradeLevelValue] = useState("");
  const [questionCountValue, setQuestionCountValue] = useState<number | string>(5);
  const [difficultyValue, setDifficultyValue] = useState("medium");

  // Handle input changes for all form fields
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "topic") {
      setTopicValue(value);
    } else if (name === "subject") {
      setSubjectValue(value);
    } else if (name === "gradeLevel") {
      setGradeLevelValue(value);
    } else if (name === "questionCount") {
      setQuestionCountValue(value === "" ? "" : Number(value));
    }
  };

  // Handle select changes
  const handleDifficultyChange = (value: string) => {
    setDifficultyValue(value);
  };

  // Check for approved content on page load
  useEffect(() => {
    const checkApprovedId = async () => {
      // Initialize form with default values even if no approved content
      setSelectedTypes(["multiple_choice"]);
      setSelectedBloomsLevels(["understand"]);

      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('approved');

      if (id) {
        setIsLoading(true);
        setApprovedId(id);
        setHasApprovedId(true);

        try {
          // Fetch the approved data
          const response = await fetch(`/api/tools/quiz-generator?approved=${id}`);
          const data = await response.json();

          if (response.ok && data) {
            // Prefill form fields from approved data
            if (data.input_data) {
              // Set input values
              setTopicValue(data.input_data.topic || '');
              setSubjectValue(data.input_data.subject || '');
              setGradeLevelValue(data.input_data.gradeLevel || '');
              setQuestionCountValue(data.input_data.questionCount || 5);
              setDifficultyValue(data.input_data.difficulty || 'medium');

              // Set selected types
              if (data.input_data.questionTypes && Array.isArray(data.input_data.questionTypes)) {
                setSelectedTypes(data.input_data.questionTypes);
              }

              // Set bloom's levels
              if (data.input_data.bloomsLevels && Array.isArray(data.input_data.bloomsLevels)) {
                setSelectedBloomsLevels(data.input_data.bloomsLevels);
              } else if (typeof data.input_data.bloomsLevels === 'string') {
                // Handle if it's a comma-separated string
                setSelectedBloomsLevels(data.input_data.bloomsLevels.split(',').map((l: string) => l.trim()));
              }

              // Load the quiz response
              setQuizResponse(data.stored_quiz);
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
    setQuizResponse(null);

    // Use state values rather than form data
    const data = {
      topic: topicValue,
      questionCount: Number(questionCountValue),
      difficulty: difficultyValue,
      questionTypes: selectedTypes,
      subject: subjectValue,
      gradeLevel: gradeLevelValue,
      bloomsLevels: selectedBloomsLevels.length > 0 ? selectedBloomsLevels : ["understand"], // Default if none selected
    };

    try {
      const response = await fetch(`/api/tools/quiz-generator${approvedId ? `?approved=${approvedId}` : ''}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setQuizResponse(result.stored_quiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setIsLoading(false);
      setIsChecked(!isChecked);
    }
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleBloomsToggle = (level: string) => {
    setSelectedBloomsLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4 py-12'>
        <div className='flex justify-end mb-4'>
          <ReportButton toolType='quiz' position='inline' variant='pre' />
        </div>
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Quiz Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Generate customized quizzes with various question types and
            difficulty levels.
          </p>
        </div>

        <div className='grid gap-8 lg:grid-cols-2 max-w-7xl mx-auto'>
          {/* Form Card */}
          <Card className='p-8 shadow-lg'>
            <form ref={formRef} onSubmit={handleSubmit} className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='topic'>Topic</Label>
                <Input
                  id='topic'
                  name='topic'
                  required
                  placeholder='Enter quiz topic...'
                  disabled={hasApprovedId}
                  readOnly={hasApprovedId}
                  value={topicValue}
                  onChange={handleInputChange}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='subject'>Subject</Label>
                  <Input
                    id='subject'
                    name='subject'
                    required
                    placeholder='e.g., Mathematics'
                    disabled={hasApprovedId}
                    readOnly={hasApprovedId}
                    value={subjectValue}
                    onChange={handleInputChange}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='gradeLevel'>Year Group</Label>
                  <Input
                    id='gradeLevel'
                    name='gradeLevel'
                    required
                    placeholder='e.g., Grade 10'
                    disabled={hasApprovedId}
                    readOnly={hasApprovedId}
                    value={gradeLevelValue}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label>Bloom's Taxonomy Levels</Label>
                <div className='grid grid-cols-3 gap-2'>
                  {bloomsLevels.map((level) => (
                    <div
                      key={level.value}
                      className='flex items-center space-x-2'
                    >
                      <Checkbox
                        id={`blooms-${level.value}`}
                        checked={selectedBloomsLevels.includes(level.value)}
                        onCheckedChange={() => handleBloomsToggle(level.value)}
                      />
                      <Label
                        htmlFor={`blooms-${level.value}`}
                      >
                        {level.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className='space-y-2'>
                <Label>Question Types</Label>
                <div className='grid grid-cols-2 gap-4'>
                  {questionTypes.map((type) => (
                    <div key={type.id} className='flex items-center space-x-2'>
                      <Checkbox
                        id={type.id}
                        checked={selectedTypes.includes(type.id)}
                        onCheckedChange={() => !hasApprovedId && handleTypeToggle(type.id)}
                        disabled={hasApprovedId}
                      />
                      <Label
                        htmlFor={type.id}
                        className={hasApprovedId ? 'opacity-70' : ''}
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='questionCount'>Number of Questions</Label>
                  <Input
                    id='questionCount'
                    name='questionCount'
                    type='number'
                    required
                    min={1}
                    max={20}
                    value={questionCountValue}
                    onChange={handleInputChange}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='difficulty'>Difficulty Level</Label>
                  <Select
                    name='difficulty'
                    value={difficultyValue}
                    onValueChange={handleDifficultyChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select difficulty' />
                    </SelectTrigger>
                    <SelectContent>
                      {difficultyLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasApprovedId && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800 text-sm">
                  <p className="font-medium">Some fields are locked based on approved content</p>
                  <p>You can still adjust Bloom's Taxonomy levels, number of questions, and difficulty level.</p>
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
                  selectedTypes.length === 0 ||
                  selectedBloomsLevels.length === 0
                }
                className='w-full'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating...
                  </>
                ) : (
                  "Generate Quiz"
                )}
              </Button>
            </form>
          </Card>

          {/* Results Card */}
          <Card className='p-8 shadow-lg'>
            <h2 className='text-2xl font-bold text-gray-900 mb-6'>
              Generated Quiz
            </h2>

            {error && (
              <div className='bg-red-50 text-red-600 p-4 rounded-lg mb-6'>
                {error}
              </div>
            )}

            {isLoading ? (
              <div className='animate-pulse space-y-4'>
                <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                <div className='h-4 bg-gray-200 rounded w-full'></div>
                <div className='h-4 bg-gray-200 rounded w-5/6'></div>
              </div>
            ) : quizResponse && quizResponse.quiz_data && quizResponse.quiz_data.questions && quizResponse.quiz_data.questions.length > 0 ? (
              <div className='space-y-6'>
                {/* Quiz Title and Metadata */}
                <div className='bg-white p-6 rounded-lg border border-gray-100'>
                  <h3 className='font-semibold text-gray-900 mb-3'>
                    {quizResponse.quiz_data.metadata.title}
                  </h3>
                  <div className='grid grid-cols-2 gap-2 text-sm text-gray-600'>
                    {quizResponse.quiz_data.metadata.subject && (
                      <p>Subject: {quizResponse.quiz_data.metadata.subject}</p>
                    )}
                    {quizResponse.quiz_data.metadata.gradeLevel && (
                      <p>Grade: {quizResponse.quiz_data.metadata.gradeLevel}</p>
                    )}
                    {quizResponse.quiz_data.metadata.duration && (
                      <p>
                        Duration: {quizResponse.quiz_data.metadata.duration}{" "}
                        minutes
                      </p>
                    )}
                  </div>
                  {quizResponse.quiz_data.metadata.bloomsLevel && (
                    <p className='text-sm text-gray-600 mt-2'>
                      Bloom's Level:{" "}
                      {quizResponse.quiz_data.metadata.bloomsLevel}
                    </p>
                  )}
                </div>

                {/* Instructions */}
                {/* {quizResponse.quiz_data.instructions && (
                  <div className='bg-white p-6 rounded-lg border border-gray-100'>
                    <h3 className='font-semibold text-gray-900 mb-3'>
                      Instructions
                    </h3>
                    <ul className='list-disc list-inside space-y-2'>
                      {quizResponse.quiz_data.instructions.map(
                        (instruction: any, idx: any) => (
                          <li key={idx} className='text-gray-700'>
                            {instruction}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )} */}

                {/* Questions */}
                <div className='space-y-4'>
                  {quizResponse.quiz_data.questions.map((question: any, idx: any) => (
                    <div
                      key={idx}
                      className='bg-white p-6 rounded-lg border border-gray-100'
                    >
                      <div className='flex justify-between items-start mb-4'>
                        <h4 className='font-medium'>Question {idx + 1}</h4>
                        <div className='text-sm text-right'>
                          {question.bloomsLevel && (
                            <span className='text-teal-500 capitalize block font-medium'>
                              {question.bloomsLevel}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className='text-gray-800 mb-4'>
                        {question.questionText}
                      </p>
                      <div className='space-y-3'>
                        {question.questionType === "fill_in_blanks" ? (
                          <div className='space-y-2'>
                            <div className='bg-green-50 border border-green-200 p-3 rounded-lg'>
                              <p className='font-medium mb-2'>Answers:</p>
                              {question.blanks?.map((blank: any, blankIdx: number) => (
                                <div key={blankIdx} className='ml-4 mb-2'>
                                  <p className='text-gray-800'>
                                    <span className='font-medium'>Blank {blank.position}:</span> {blank.word}
                                    {blank.hint && (
                                      <span className='text-gray-600 ml-2 italic'>(Hint: {blank.hint})</span>
                                    )}
                                  </p>
                                </div>
                              ))}
                              {question.explanation && (
                                <div className='mt-3 pt-3 border-t border-green-200'>
                                  <p className='text-gray-700'>
                                    <span className='font-medium'>Explanation:</span> {question.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : question.questionType === "short_answer" ? (
                          <div className='space-y-2'>
                            <div className='bg-green-50 border border-green-200 p-3 rounded-lg'>
                              <p className='font-medium'>
                                Correct Answer: {question.correctAnswer}
                              </p>
                              {question.acceptableAnswers &&
                                question.acceptableAnswers.length > 0 && (
                                  <div className='mt-2'>
                                    <p className='text-sm text-gray-600'>
                                      Acceptable alternatives:
                                    </p>
                                    <ul className='list-disc list-inside text-sm text-gray-600 ml-2'>
                                      {question.acceptableAnswers.map(
                                        (answer: string, i: number) => (
                                          <li key={i}>{answer}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                            </div>
                            {question.explanation && (
                              <p className='text-sm text-gray-600 mt-1'>
                                {question.explanation}
                              </p>
                            )}
                          </div>
                        ) : (
                          question?.options?.map((option: any, optIdx: any) => (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-lg ${option.isCorrect
                                ? "bg-green-50 border border-green-200"
                                : "bg-gray-50 border border-gray-200"
                                }`}
                            >
                              <p className='font-medium'>{option.text}</p>
                              {option.explanation && (
                                <p className='text-sm text-gray-600 mt-1'>
                                  {option.explanation}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className='text-center text-gray-500 p-12'>
                Your generated quiz will appear here
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}