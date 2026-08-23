import { TRUST_TIERS } from "../evidence/trust";
import type { EvidenceNode } from "../evidence/evidence-schema";
import type { DecodedTransfer } from "./decode-transfer";

const ONCHAIN_TIER = "T0_ONCHAIN" as const;

if (!TRUST_TIERS.includes(ONCHAIN_TIER)) {
  throw new Error("T0_ONCHAIN trust tier is missing from evidence trust configuration");
}

export function buildOnchainEvidence(
  decoded: DecodedTransfer,
  provenance?: {
    transactionHash?: string;
    blockNumber?: bigint | number | string;
    contractAddress?: string;
    network?: string;
  },
): EvidenceNode[] {
  const base: Omit<EvidenceNode, "id" | "field" | "value" | "evidenceText"> & { evidenceText?: string } = {
    sourceId: decoded.sourceId,
    sourceType: "evm_transaction",
    trustTier: ONCHAIN_TIER,
    extraction: "explicit" as const,
  };
  if (provenance) {
    base.transactionHash = provenance.transactionHash;
    base.contractAddress = provenance.contractAddress;
    base.network = provenance.network;
    if (provenance.blockNumber !== undefined) {
      base.blockNumber = String(provenance.blockNumber);
    }
  }

  return [
    {
      id: `${decoded.sourceId}::recipient`,
      field: "recipient",
      value: decoded.recipient,
      evidenceText: decoded.recipient,
      ...base,
    },
    {
      id: `${decoded.sourceId}::amount`,
      field: "amount",
      value: decoded.amountFormatted,
      evidenceText: `${decoded.amountFormatted} ${decoded.asset}`,
      ...base,
    },
    {
      id: `${decoded.sourceId}::asset`,
      field: "asset",
      value: decoded.asset,
      evidenceText: decoded.asset,
      ...base,
    },
  ];
}
