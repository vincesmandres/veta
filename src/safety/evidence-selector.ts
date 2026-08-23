import type { EvidenceNode } from "../evidence/evidence-schema";

const AUTHORITATIVE_TIERS = new Set(["T1_AUTHORITY"]);
const ONCHAIN_TIERS = new Set(["T0_ONCHAIN"]);

export function selectEvidence(
  evidence: EvidenceNode[],
  field: EvidenceNode["field"],
  trustTiers: Set<string>,
): EvidenceNode[] {
  return evidence.filter((node) => node.field === field && trustTiers.has(node.trustTier as string));
}

export function getAuthoritativeEvidence(
  evidence: EvidenceNode[],
  field: EvidenceNode["field"],
): EvidenceNode[] {
  return selectEvidence(evidence, field, AUTHORITATIVE_TIERS);
}

export function getOnchainEvidence(
  evidence: EvidenceNode[],
  field: EvidenceNode["field"],
): EvidenceNode[] {
  return selectEvidence(evidence, field, ONCHAIN_TIERS);
}

export function getExpectedValue(nodes: EvidenceNode[]): string | null {
  const values = nodes
    .map((node) => (typeof node.value === "string" || typeof node.value === "number" ? String(node.value) : null))
    .filter((value): value is string => value !== null);

  if (values.length === 0) {
    return null;
  }

  const unique = Array.from(new Set(values));
  if (unique.length > 1) {
    return null;
  }

  return unique[0];
}

export function hasConflictingValues(nodes: EvidenceNode[]): boolean {
  const values = nodes
    .map((node) => (typeof node.value === "string" || typeof node.value === "number" ? String(node.value) : null))
    .filter((value): value is string => value !== null);

  return new Set(values).size > 1;
}
