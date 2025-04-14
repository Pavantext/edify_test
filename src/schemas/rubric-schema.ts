import { z } from "zod";

const FeedbackSchema = z
  .object({
    text: z.string(),
    suggestions: z.array(z.string()),
    actionableSteps: z.array(z.string()),
  })
  .required();

const CriterionSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    feedbackByLevel: z.object({
      exemplary: FeedbackSchema,
      proficient: FeedbackSchema,
      developing: FeedbackSchema,
      beginning: FeedbackSchema,
    }),
  })
  .required();

export const RubricResponseSchema = z.object({
  data: z
    .object({
      id: z.string(),
      version: z.string(),
      createdAt: z.string(),
      metadata: z
        .object({
          assignmentType: z.string(),
          customAssignmentType: z.string().optional(),
          keyStage: z.string(),
          yearGroup: z.number(),
          assessmentType: z.string(),
        })
        .required(),
      rubric: z
        .object({
          criteria: z.array(CriterionSchema),
          instructions: z
            .object({
              teacher: z.array(z.string()),
              peer: z.array(z.string()).optional(),
              self: z.array(z.string()).optional(),
            })
            .required(),
        })
        .required(),
    })
    .required(),
});
