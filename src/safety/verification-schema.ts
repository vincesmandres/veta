import { z } from "zod";

export const verificationStatusSchema = z.enum(["PASS", "FAIL", "UNKNOWN"]);

export const verificationSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);

export const verificationTypeSchema = z.enum([
  "RECIPIENT_MATCH",
  "AMOUNT_MATCH",
  "ASSET_MATCH",
  "EVIDENCE_COMPLETE",
]);

export const verificationCheckSchema = z.object({
  type: verificationTypeSchema,
  status: verificationStatusSchema,
  severity: verificationSeveritySchema,
  expected: z.string().optional(),
  observed: z.string().optional(),
  reason: z.string().optional(),
}).strict();

export const verdictSchema = z.enum(["APPROVE", "BLOCK", "REVIEW"]);

export const verificationResultSchema = z.object({
  verdict: verdictSchema,
  checks: z.array(verificationCheckSchema).min(1),
  reasons: z.array(z.string()).min(0),
  evidenceUsed: z.array(z.string()).min(0),
}).strict();

export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type VerificationSeverity = z.infer<typeof verificationSeveritySchema>;
export type VerificationType = z.infer<typeof verificationTypeSchema>;
export type VerificationCheck = z.infer<typeof verificationCheckSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
