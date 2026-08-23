import type { EvidenceNode } from "../evidence/evidence-schema";
import { runSafetyKernel } from "../safety/safety-kernel";
import type { VerificationResult } from "../safety/verification-schema";
import { resolveAuthority } from "./resolver";

export function verifyWithAuthority(evidence: EvidenceNode[]): { authority: ReturnType<typeof resolveAuthority>; safety: VerificationResult } {
  const authority = resolveAuthority(evidence);
  const resolvedEvidence = authority.selectedEvidence.flatMap((node) => {
    if (node.field !== "recipient" && node.field !== "amount" && node.field !== "asset") return [];
    const field = authority.fields[node.field];
    if (field.status !== "RESOLVED" || field.value === undefined || field.evidenceIds[0] !== node.id) return [];
    return [{ ...node, value: field.value }];
  });
  const kernel = runSafetyKernel([...resolvedEvidence, ...evidence.filter((node) => node.trustTier === "T0_ONCHAIN")]);
  const reasons = Array.from(new Set([...kernel.reasons, ...authority.reasons]));
  return { authority, safety: { ...kernel, reasons } };
}
