import { z } from "zod";

const LessonSchema = z.object({
  lessonNumber: z.number(),
  title: z.string(),
  duration: z.number(),
  learningObjectives: z.array(z.string()),
  activities: z.array(z.object({
    title: z.string(),
    description: z.string(),
    duration: z.number(),
    resources: z.array(z.string()).optional(),
  })),
  assessment: z.array(z.string()).optional(),
  differentiation: z.object({
    support: z.array(z.string()).optional(),
    core: z.array(z.string()).optional(),
    extension: z.array(z.string()).optional(),
  }).optional(),
  stretchTasks: z.array(z.string()).optional(),
  scaffoldingStrategies: z.array(z.string()).optional(),
  reflectionPrompts: z.array(z.string()).optional(),
  crossCurricularLinks: z.array(z.string()).optional(),
});

const MetadataSchema = z.object({
  author: z.string(),
  createdAt: z.string(),
  version: z.string(),
});

export const SOWSchema = z.object({
  data: z.object({
    id: z.string(),
    subject: z.string(),
    topic: z.string(),
    ageGroup: z.object({
      year: z.number(),
    }),
    overarchingObjectives: z.array(z.string()),
    lessons: z.array(LessonSchema),
    metadata: MetadataSchema,
    assessmentQuestions: z.object({
      knowledge: z.array(z.string()).optional(),
      comprehension: z.array(z.string()).optional(),
      application: z.array(z.string()).optional(),
      analysis: z.array(z.string()).optional(),
      synthesis: z.array(z.string()).optional(),
      evaluation: z.array(z.string()).optional(),
    }).optional(),
    differentiationAndSEN: z.object({
      differentiation: z.object({
        support: z.array(z.string()).optional(),
        core: z.array(z.string()).optional(),
        extension: z.array(z.string()).optional(),
      }).optional(),
      senSupport: z.record(z.string(), z.array(z.string())).optional(),
    }).optional(),
  }),
});

export type Lesson = z.infer<typeof LessonSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type SOW = z.infer<typeof SOWSchema>;
