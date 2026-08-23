import { z } from "zod";
import { TRUST_TIERS } from "./trust";

export const evidenceFieldSchema = z.enum([
  "invoiceId",
  "amount",
  "asset",
  "counterparty",
]);

export const extractionStateSchema = z.enum(["explicit", "derived", "missing"]);

export const trustTierSchema = z.enum(TRUST_TIERS);

export const evidenceNodeSchema = z.object({
  id: z.string().trim().min(1),
  field: evidenceFieldSchema,
  value: z.union([z.string(), z.number()]).nullable(),
  sourceId: z.string().trim().min(1),
  trustTier: trustTierSchema,
  extraction: extractionStateSchema,
  evidenceText: z.string().trim().min(1).optional(),
}).strict();

export type EvidenceField = z.infer<typeof evidenceFieldSchema>;
export type ExtractionState = z.infer<typeof extractionStateSchema>;
export type EvidenceNode = z.infer<typeof evidenceNodeSchema>;
