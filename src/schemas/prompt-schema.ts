import { z } from "zod";

// Schema for complexity level
const ComplexityLevelSchema = z.object({
  cognitiveLoad: z.number().min(1).max(5),
  bloomsLevel: z.enum([
    "Remember",
    "Understand",
    "Apply",
    "Analyse",
    "Evaluate",
    "Create",
  ]),
});

// Schema for prompt explanation
const PromptExplanationSchema = z.object({
  explanation: z.string(),
  complexityLevel: ComplexityLevelSchema,
  focusAreas: z.array(z.string()),
});

// Schema for optional ratings
const RatingsSchema = z.object({
  averageRating: z.number().optional(),
  totalRatings: z.number().optional(),
});

// Schema for a single refined prompt
const RefinedPromptSchema = z.object({
  promptText: z.string(),
  explanation: PromptExplanationSchema,
  ratings: RatingsSchema.optional(),
});

// Schema for metadata
const MetadataSchema = z.object({
  processingTimeMs: z.number(),
  version: z.string(),
  model: z.string(),
});

// Main response schema
export const PromptGeneratorResponseSchema = z.object({
  data: z.object({
    originalPrompt: z.string(),
    refinedPrompts: z.array(RefinedPromptSchema).length(3),
    metadata: MetadataSchema,
  }),
});

// Input schema for the API
export const PromptGeneratorInputSchema = z.object({
  originalPrompt: z.string().max(500).min(1, "Original prompt is required"),
  focusAreas: z.array(z.string()).min(1, "At least one focus area is required"),
  // grade: z.string().optional(),
  // subject: z.string().optional(),
  // skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
});

// Type exports
export type PromptGeneratorResponse = z.infer<
  typeof PromptGeneratorResponseSchema
>;
export type PromptGeneratorInput = z.infer<typeof PromptGeneratorInputSchema>;
