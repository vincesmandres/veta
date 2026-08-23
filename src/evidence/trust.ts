import type { EvidenceSourceType } from "./source-schema";

export const TRUST_TIERS = ["T0_ONCHAIN", "T1_AUTHORITY", "T2_SUPPORTING", "T3_UNTRUSTED"] as const;

export type TrustTier = (typeof TRUST_TIERS)[number];

const TRUST_TIER_BY_SOURCE: Record<EvidenceSourceType, TrustTier> = {
  payment_request: "T1_AUTHORITY",
  policy: "T1_AUTHORITY",
  vendor_registry: "T1_AUTHORITY",
  invoice: "T2_SUPPORTING",
  free_text: "T3_UNTRUSTED",
};

export function trustTierForSourceType(sourceType: EvidenceSourceType): TrustTier {
  return TRUST_TIER_BY_SOURCE[sourceType];
}
