import { z } from "zod";

// Schema for quiz question options
const QuizOptionSchema = z.object({
  text: z.string().min(1, "Option text is required"),
  isCorrect: z.boolean(),
  explanation: z.string().optional(),
});

// Schema for individual quiz questions
const QuizQuestionSchema = z.object({
  questionText: z.string().min(5, "Question must be at least 5 characters"),
  options: z.array(QuizOptionSchema)
    .min(2, "At least 2 options required")
    .max(5, "Maximum 5 options allowed"),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  points: z.number().min(1).max(10),
  feedback: z.object({
    correct: z.string(),
    incorrect: z.string(),
  }),
});

// Main quiz schema
export const QuizSchema = z.object({
  metadata: z.object({
    title: z.string().min(1, "Quiz title is required"),
    subject: z.string().optional(),
    gradeLevel: z.string().optional(),
    duration: z.number().min(5).max(180).optional(), // in minutes
    totalPoints: z.number().optional(),
    createdAt: z.string().datetime(),
  }),
  questions: z.array(QuizQuestionSchema)
    .min(1, "At least one question is required"),
  instructions: z.array(z.string()).optional(),
});

export type QuizOption = z.infer<typeof QuizOptionSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type Quiz = z.infer<typeof QuizSchema>; 