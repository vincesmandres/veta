import { z } from "zod";
import { paymentIntentSchema } from "../qvac/payment-schema";
import { evidenceNodeSchema } from "./evidence-schema";

export const evidenceResultSchema = z.object({
  intent: paymentIntentSchema,
  evidence: z.array(evidenceNodeSchema).min(1),
}).strict();

export type EvidenceResult = z.infer<typeof evidenceResultSchema>;
