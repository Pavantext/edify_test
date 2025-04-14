import { z } from "zod";

// Schema for PEEL paragraph content
const PEELContentSchema = z.object({
  point: z.string()
    .min(10, "Point must be at least 10 characters")
    .max(500, "Point must be less than 500 characters"),
  evidence: z.string()
    .min(20, "Evidence must be at least 20 characters")
    .max(1000, "Evidence must be less than 1000 characters"),
  explanation: z.string()
    .min(30, "Explanation must be at least 30 characters")
    .max(1000, "Explanation must be less than 1000 characters"),
  link: z.string()
    .min(10, "Link must be at least 10 characters")
    .max(500, "Link must be less than 500 characters"),
});

// Main PEEL schema
export const PEELSchema = z.object({
  content: PEELContentSchema,
  metadata: z.object({
    subject: z.string().optional(),
    complexity: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
});

export type PEELContent = z.infer<typeof PEELContentSchema>;
export type PEELResponse = z.infer<typeof PEELSchema>; 