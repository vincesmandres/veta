import { TRUST_TIERS } from "../evidence/trust";
import type { EvidenceNode } from "../evidence/evidence-schema";
import type { DecodedTransfer } from "./decode-transfer";

const ONCHAIN_TIER = "T0_ONCHAIN" as const;

if (!TRUST_TIERS.includes(ONCHAIN_TIER)) {
  throw new Error("T0_ONCHAIN trust tier is missing from evidence trust configuration");
}

export function buildOnchainEvidence(decoded: DecodedTransfer): EvidenceNode[] {
  return [
    {
      id: `${decoded.sourceId}::recipient`,
      field: "recipient",
      value: decoded.recipient,
      sourceId: decoded.sourceId,
      trustTier: ONCHAIN_TIER,
      extraction: "explicit",
      evidenceText: decoded.recipient,
    },
    {
      id: `${decoded.sourceId}::amount`,
      field: "amount",
      value: decoded.amountFormatted,
      sourceId: decoded.sourceId,
      trustTier: ONCHAIN_TIER,
      extraction: "explicit",
      evidenceText: `${decoded.amountFormatted} ${decoded.asset}`,
    },
    {
      id: `${decoded.sourceId}::asset`,
      field: "asset",
      value: decoded.asset,
      sourceId: decoded.sourceId,
      trustTier: ONCHAIN_TIER,
      extraction: "explicit",
      evidenceText: decoded.asset,
    },
  ];
}
