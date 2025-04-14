import { z } from "zod";

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  model: z.enum(["gpt-4-turbo-preview"]),
  created_at: z.string().datetime(),
  response_history: z.array(z.object({
    id: z.string().uuid(),
    content: z.string(),
    created_at: z.string().datetime(),
    type: z.enum(["original", "retry", "edit"])
  })).optional(),
  currentResponseIndex: z.number().optional(),
  metadata: z
    .object({
      tokens: z.number().optional(),
      processingTime: z.number().optional(),
      modelVersion: z.string().optional(),
      safetyChecks: z.object({
        flagged: z.boolean().optional(),
        categories: z.array(z.string()).optional(),
        injectionAttempt: z.boolean().optional(),
        biasDetected: z.boolean().optional(),
      }).optional(),
    })
    .optional(),
  contentFlags: z.object({
    pii_detected: z.boolean().optional(),
    content_violation: z.boolean().optional(),
    bias_detected: z.boolean().optional(),
    prompt_injection_detected: z.boolean().optional(),
    fraudulent_intent_detected: z.boolean().optional(),
    misinformation_detected: z.boolean().optional(),
    self_harm_detected: z.boolean().optional(),
    extremist_content_detected: z.boolean().optional(),
    child_safety_violation: z.boolean().optional(),
    automation_misuse_detected: z.boolean().optional(),
  }).optional(),
});

// Schema for chat sessions
export const chatSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  user_id: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  messages: z.array(chatMessageSchema),
  model: z.enum(["gpt-4-turbo-preview"]),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatSession = z.infer<typeof chatSessionSchema>;

// Export ModelType for reuse
export type ModelType = "gpt-4-turbo-preview";
