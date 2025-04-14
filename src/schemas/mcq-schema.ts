import { z } from "zod";

const MCQAnswerSchema = z.object({
  text: z.string(),
  isCorrect: z.boolean(),
  explanation: z.string().optional(),
});

const MCQQuestionSchema = z.object({
  text: z.string(),
  taxonomyLevel: z.string(),
  answers: z.array(MCQAnswerSchema),
  explanation: z.string().optional(),
});

export const MCQGeneratorSchema = z.object({
  data: z.object({
    questions: z.array(MCQQuestionSchema),
    metadata: z.object({
      topic: z.string(),
      difficulty: z.string(),
      totalQuestions: z.number(),
      taxonomyLevels: z.array(z.string()),
      timestamp: z.string(),
    }),
  }),
});

export type MCQAnswer = z.infer<typeof MCQAnswerSchema>;
export type MCQQuestion = z.infer<typeof MCQQuestionSchema>;
export type APIResponseType = z.infer<typeof MCQGeneratorSchema>;
