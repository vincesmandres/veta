import type { EvidenceNode } from "./evidence-schema";
import type { EvidenceSource } from "./source-schema";
import type { PaymentIntent } from "../qvac/payment-schema";
import { trustTierForSourceType } from "./trust";
import { evidenceResultSchema } from "./result-schema";

export type BuiltEvidence = {
  nodes: EvidenceNode[];
};

type EvidenceField = "invoiceId" | "amount" | "asset" | "counterparty";

const FIELD_EVIDENCE_TEXT: Record<EvidenceField, (content: string, intent: PaymentIntent) => string | undefined> = {
  invoiceId: (content, intent) => {
    if (intent.invoiceId && content.includes(intent.invoiceId)) return intent.invoiceId;
    return undefined;
  },
  amount: (content, intent) => matchFirst(content, [`${intent.amount} ${intent.asset}`, String(intent.amount)]),
  asset: (content, intent) => matchFirst(content, [intent.asset]),
  counterparty: (content, intent) => matchFirst(content, [intent.counterparty]),
};

function matchFirst(content: string, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate && content.includes(candidate)) return candidate;
  }
  return undefined;
}

export function buildEvidence(source: EvidenceSource, intent: PaymentIntent): BuiltEvidence {
  const trustTier = trustTierForSourceType(source.type);
  const nodes: EvidenceNode[] = [];

  const fields: EvidenceField[] = ["invoiceId", "amount", "asset", "counterparty"];
  for (const field of fields) {
    const value = intent[field];
    const extraction = field === "invoiceId" && value === null ? "missing" : "explicit";
    nodes.push({
      id: `${source.id}::${field}`,
      field,
      value,
      sourceId: source.id,
      sourceType: source.type,
      trustTier,
      extraction,
      evidenceText: FIELD_EVIDENCE_TEXT[field](source.content, intent),
    });
  }

  return { nodes };
}

export function buildEvidenceResult(source: EvidenceSource, intent: PaymentIntent) {
  return evidenceResultSchema.parse({ intent, evidence: buildEvidence(source, intent).nodes });
}
