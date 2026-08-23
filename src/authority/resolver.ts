import type { EvidenceNode } from "../evidence/evidence-schema";
import { authorityLevelForNode, type AuthorityLevel, type CriticalField } from "./authority-policy";
import { canonicalize } from "./canonicalize";

export type FieldResolution = {
  field: CriticalField;
  status: "RESOLVED" | "CONFLICT" | "UNRESOLVED";
  value?: string;
  authorityLevel?: AuthorityLevel;
  evidenceIds: string[];
  ignoredEvidenceIds?: string[];
  warnings?: string[];
  reason?: string;
};

export type AuthorityResolution = {
  fields: Record<CriticalField, FieldResolution>;
  safeToVerify: boolean;
  reasons: string[];
  metrics: {
    resolvedFields: number;
    conflictedFields: number;
    unresolvedFields: number;
    ignoredLowerAuthorityEvidence: number;
    supportingConflicts: number;
  };
  selectedEvidence: EvidenceNode[];
};

const FIELDS: CriticalField[] = ["recipient", "amount", "asset"];
const AUTHORITY_RANK: Record<AuthorityLevel, number> = { AUTHORITATIVE: 3, POLICY: 2, SUPPORTING: 1, UNTRUSTED: 0, NONE: -1 };

export function resolveAuthority(evidence: EvidenceNode[]): AuthorityResolution {
  const fields = Object.fromEntries(FIELDS.map((field) => [field, resolveField(field, evidence)])) as Record<CriticalField, FieldResolution>;
  const reasons = FIELDS.flatMap((field) => fields[field].reason && fields[field].status !== "RESOLVED" ? [fields[field].reason] : []);
  const metrics = {
    resolvedFields: FIELDS.filter((field) => fields[field].status === "RESOLVED").length,
    conflictedFields: FIELDS.filter((field) => fields[field].status === "CONFLICT").length,
    unresolvedFields: FIELDS.filter((field) => fields[field].status === "UNRESOLVED").length,
    ignoredLowerAuthorityEvidence: FIELDS.reduce((n, field) => n + (fields[field].ignoredEvidenceIds?.length ?? 0), 0),
    supportingConflicts: FIELDS.reduce((n, field) => n + (fields[field].warnings?.filter((warning) => warning === "SUPPORTING_EVIDENCE_CONFLICT").length ?? 0), 0),
  };
  return { fields, safeToVerify: reasons.length === 0, reasons, metrics, selectedEvidence: selectedEvidence(evidence, fields) };
}

function resolveField(field: CriticalField, evidence: EvidenceNode[]): FieldResolution {
  const nodes = evidence.filter((node) => node.field === field && node.value !== null && (typeof node.value === "string" || typeof node.value === "number"));
  const ranked = nodes.map((node) => ({ node, level: authorityLevelForNode(node, field), value: canonicalize(field, node.value as string | number) }));
  const highest = Math.max(...ranked.map((item) => AUTHORITY_RANK[item.level]), -1);
  const candidates = ranked.filter((item) => AUTHORITY_RANK[item.level] === highest && highest >= AUTHORITY_RANK.SUPPORTING);
  if (candidates.length === 0) return { field, status: "UNRESOLVED", evidenceIds: nodes.map((node) => node.id), reason: "INSUFFICIENT_AUTHORITY" };
  if (highest === AUTHORITY_RANK.SUPPORTING) return { field, status: "UNRESOLVED", authorityLevel: "SUPPORTING", evidenceIds: candidates.map((item) => item.node.id), reason: "INSUFFICIENT_AUTHORITY" };
  const values = new Set(candidates.map((item) => item.value));
  if (values.size > 1) {
    const lowerAuthority = ranked.filter((item) => AUTHORITY_RANK[item.level] < highest).map((item) => item.node.id);
    return { field, status: "CONFLICT", authorityLevel: candidates[0].level, evidenceIds: candidates.map((item) => item.node.id), ignoredEvidenceIds: lowerAuthority.length ? lowerAuthority : undefined, reason: "CONFLICTING_AUTHORITY" };
  }
  const used = ranked.filter((item) => item.value === candidates[0].value && AUTHORITY_RANK[item.level] >= AUTHORITY_RANK.SUPPORTING && AUTHORITY_RANK[item.level] <= highest).map((item) => item.node.id);
  const ignored = ranked.filter((item) => item.value !== candidates[0].value).map((item) => item.node.id);
  const warnings = ranked.filter((item) => item.level === "SUPPORTING" && item.value !== candidates[0].value).length > 0 ? ["SUPPORTING_EVIDENCE_CONFLICT"] : undefined;
  return { field, status: "RESOLVED", value: candidates[0].value, authorityLevel: candidates[0].level, evidenceIds: used, ignoredEvidenceIds: ignored.length ? ignored : undefined, warnings, reason: candidates[0].level === "SUPPORTING" ? "Supporting evidence is insufficient to authorize this field." : `${candidates[0].level} evidence has ${field} authority.` };
}

function selectedEvidence(evidence: EvidenceNode[], fields: Record<CriticalField, FieldResolution>): EvidenceNode[] {
  const ids = new Set(FIELDS.flatMap((field) => fields[field].status === "RESOLVED" ? fields[field].evidenceIds : []));
  return evidence.filter((node) => {
    if (!ids.has(node.id)) return false;
    const level = authorityLevelForNode(node, node.field as CriticalField);
    return level === "AUTHORITATIVE" || level === "POLICY";
  });
}
