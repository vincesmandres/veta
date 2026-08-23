import type { EvidenceField, EvidenceNode } from "../evidence/evidence-schema";
import type { EvidenceSourceType } from "../evidence/source-schema";
import type { TrustTier } from "../evidence/trust";

export const AUTHORITY_LEVELS = ["AUTHORITATIVE", "POLICY", "SUPPORTING", "UNTRUSTED", "NONE"] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];
export type CriticalField = Extract<EvidenceField, "recipient" | "amount" | "asset">;

type FieldPolicy = Record<CriticalField, AuthorityLevel>;

export const AUTHORITY_POLICY: Record<EvidenceSourceType, FieldPolicy> = {
  vendor_registry: { recipient: "AUTHORITATIVE", amount: "NONE", asset: "NONE" },
  payment_request: { recipient: "AUTHORITATIVE", amount: "AUTHORITATIVE", asset: "AUTHORITATIVE" },
  policy: { recipient: "POLICY", amount: "POLICY", asset: "POLICY" },
  invoice: { recipient: "SUPPORTING", amount: "SUPPORTING", asset: "SUPPORTING" },
  free_text: { recipient: "UNTRUSTED", amount: "UNTRUSTED", asset: "UNTRUSTED" },
  evm_transaction: { recipient: "NONE", amount: "NONE", asset: "NONE" },
};

export function authorityLevelForNode(node: EvidenceNode, field: CriticalField): AuthorityLevel {
  if (node.sourceType) return AUTHORITY_POLICY[node.sourceType][field];
  // Legacy M3 fixtures predate sourceType; preserve their established T1 behavior.
  const fallback: Record<TrustTier, AuthorityLevel> = {
    T0_ONCHAIN: "NONE",
    T1_AUTHORITY: "AUTHORITATIVE",
    T2_SUPPORTING: "SUPPORTING",
    T3_UNTRUSTED: "UNTRUSTED",
  };
  return fallback[node.trustTier];
}
