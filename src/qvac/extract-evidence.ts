import { extractPayment } from "./extract-payment";
import { evidenceSourceSchema } from "../evidence/source-schema";
import { buildEvidenceResult } from "../evidence/build-evidence";
import type { EvidenceSource, EvidenceResult } from "../evidence";

export type EvidenceInput = {
  source: EvidenceSource;
  content?: string;
};

export async function extractEvidence(input: EvidenceInput) {
  const source = evidenceSourceSchema.parse(input.source);
  const content = input.content ?? source.content;
  const extraction = await extractPayment(content);
  const result: EvidenceResult = buildEvidenceResult(source, extraction.paymentIntent);
  return {
    source,
    result,
    raw: extraction.raw,
    observation: extraction.observation,
  };
}
