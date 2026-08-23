import { z } from "zod";

export const evidenceSourceTypeSchema = z.enum([
  "payment_request",
  "policy",
  "vendor_registry",
  "invoice",
  "free_text",
]);

export const evidenceSourceSchema = z.object({
  id: z.string().trim().min(1),
  type: evidenceSourceTypeSchema,
  content: z.string(),
}).strict();

export type EvidenceSourceType = z.infer<typeof evidenceSourceTypeSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
