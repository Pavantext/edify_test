import { z } from "zod";

export const lessonPlanSchema = z.object({
  topic: z.string().min(1, "Topic is required").max(100, "Topic is too long"),
  yearGroup: z
    .string()
    .regex(/^(Year\s\d{1,2}|Grade\s\d{1,2})$/, "Year group format is invalid")
    .optional(),
  duration: z
    .number()
    .min(1, "Duration must be at least 1 minute")
    .max(300, "Duration cannot exceed 300 minutes"),
  objectives: z
    .array(z.string().min(1, "Objective cannot be empty"))
    .nonempty("At least one objective is required"),
  activities: z
    .array(
      z.object({
        type: z.enum([
          "discussion",
          "analysis",
          "debate",
          "case study",
          "group work",
        ]),
        description: z.string().min(1, "Activity description cannot be empty"),
        materials: z.array(z.string()).optional(),
        duration: z
          .number()
          .min(1, "Activity duration must be at least 1 minute")
          .optional(),
        differentiation: z
          .object({
            dyslexia: z.boolean().optional(),
            adhd: z.boolean().optional(),
            asd: z.boolean().optional(),
            visualImpairment: z.boolean().optional(),
            hearingImpairment: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .nonempty("At least one activity is required"),
  assessmentQuestions: z
    .array(
      z.object({
        level: z.enum([
          "knowledge",
          "comprehension",
          "application",
          "analysis",
          "synthesis",
          "evaluation",
        ]),
        question: z.string().min(1, "Question cannot be empty"),
        exampleAnswer: z.string().optional(),
      })
    )
    .nonempty("At least one assessment question is required"),
  crossCurricularLinks: z
    .array(
      z.object({
        subject: z.enum([
          "Economics",
          "Geography",
          "Politics",
          "History",
          "Other",
        ]),
        description: z
          .string()
          .min(1, "Cross-curricular link description cannot be empty"),
      })
    )
    .optional(),
});

export type LessonPlan = z.infer<typeof lessonPlanSchema>;
