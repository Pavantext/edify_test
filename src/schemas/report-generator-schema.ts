import { z } from "zod";

const ReportSectionsSchema = z.object({
  overarchingAssessment: z.string(),
  target: z.string(),
  supportiveEndNote: z.string(),
});

const ReportMetadataSchema = z.object({
  student: z.string(),
  generatedAt: z.string(),
  wordCount: z.number(),
  version: z.string(),
});

const ReportOutputSchema = z.object({
  areasOfStrength: z.string(),
  reportSections: ReportSectionsSchema,
  completeReport: z.string(),
  metadata: ReportMetadataSchema,
});

export const reportGeneratorSchema = z.object({
  data: z.object({
    output: ReportOutputSchema,
  }),
});

export type ReportSections = z.infer<typeof ReportSectionsSchema>;
export type ReportMetadata = z.infer<typeof ReportMetadataSchema>;
export type ReportOutput = z.infer<typeof ReportOutputSchema>;
export type ApiResponse = z.infer<typeof reportGeneratorSchema>;
