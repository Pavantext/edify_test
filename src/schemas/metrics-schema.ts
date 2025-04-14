import { z } from "zod";

export const contentFlagsSchema = z.object({
  pii_detected: z.boolean().default(false),
  content_violation: z.boolean().default(false),
  bias_detected: z.boolean().default(false),
  prompt_injection_detected: z.boolean().default(false),
  fraudulent_intent_detected: z.boolean().default(false),
  misinformation_detected: z.boolean().default(false),
  self_harm_detected: z.boolean().default(false),
  extremist_content_detected: z.boolean().default(false),
  child_safety_violation: z.boolean().default(false),
  automation_misuse_detected: z.boolean().default(false),
});

export const chatMetricsSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  session_id: z.string().uuid(),
  model: z.string(),
  input_length: z.number().int(),
  response_length: z.number().int(),
  duration_ms: z.number(),
  error_type: z.string().nullable(),
  status_code: z.number().nullable(),
  timestamp: z.string().datetime(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  total_tokens: z.number(),
  price_gbp: z.number().min(0),
  prompt_id: z.string().uuid().nullable(),
  content_flags: contentFlagsSchema
});

export type ContentFlags = z.infer<typeof contentFlagsSchema>;
export type ChatMetrics = z.infer<typeof chatMetricsSchema>; 