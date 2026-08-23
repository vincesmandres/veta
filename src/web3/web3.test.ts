import { describe, expect, it } from "vitest";
import { encodeFunctionData } from "viem";
import { erc20Abi } from "./erc20-abi";
import { decodeTransfer, buildOnchainEvidence, Web3Error } from "./index";
import { evmTransactionSourceSchema } from "./transaction-schema";
import { evidenceNodeSchema } from "../evidence/evidence-schema";

const tokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const recipientA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const recipientB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const usdtDecimals = BigInt(6);

function makeTransaction(id: string, recipient: string, amountRaw: bigint, symbol = "USDT") {
  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient as `0x${string}`, amountRaw],
  });
  return evmTransactionSourceSchema.parse({
    id,
    chain: "evm",
    tokenAddress,
    calldata,
    decimals: 6,
    symbol,
  });
}

describe("M2 EVM reality", () => {
  it("decodes a valid transfer and recovers recipient and raw amount", () => {
    const amountRaw = BigInt(1250) * (BigInt(10) ** usdtDecimals);
    const decoded = decodeTransfer(makeTransaction("TX-001", recipientA, amountRaw));
    expect(decoded.recipient.toLowerCase()).toBe(recipientA.toLowerCase());
    expect(decoded.amountRaw).toBe(amountRaw);
    expect(decoded.functionName).toBe("transfer");
  });

  it("preserves a different recipient", () => {
    const decoded = decodeTransfer(makeTransaction("TX-002", recipientB, BigInt(1250) * (BigInt(10) ** usdtDecimals)));
    expect(decoded.recipient.toLowerCase()).toBe(recipientB.toLowerCase());
  });

  it("preserves a different amount", () => {
    const decoded = decodeTransfer(makeTransaction("TX-003", recipientA, BigInt(12500) * (BigInt(10) ** usdtDecimals)));
    expect(decoded.amountRaw).toBe(BigInt(12500) * (BigInt(10) ** usdtDecimals));
  });

  it("generates T0_ONCHAIN evidence with preserved sourceId", () => {
    const decoded = decodeTransfer(makeTransaction("TX-004", recipientA, BigInt(100)));
    const evidence = buildOnchainEvidence(decoded);
    expect(evidence).toHaveLength(3);
    expect(evidence.every((node) => node.trustTier === "T0_ONCHAIN")).toBe(true);
    expect(evidence.every((node) => node.sourceId === "TX-004")).toBe(true);
    for (const node of evidence) {
      expect(evidenceNodeSchema.safeParse(node).success).toBe(true);
    }
  });

  it("derives the human-readable amount safely from bigint", () => {
    const decoded = decodeTransfer(makeTransaction("TX-005", recipientA, BigInt(1250) * (BigInt(10) ** usdtDecimals)));
    expect(decoded.amountFormatted).toBe("1250");
  });

  it("rejects malformed calldata", () => {
    const source = evmTransactionSourceSchema.parse({
      id: "TX-BAD-1",
      chain: "evm",
      tokenAddress,
      calldata: "0x1234",
      decimals: 6,
      symbol: "USDT",
    });
    expect(() => decodeTransfer(source)).toThrow(Web3Error);
  });

  it("rejects unsupported function selectors", () => {
    const source = evmTransactionSourceSchema.parse({
      id: "TX-BAD-2",
      chain: "evm",
      tokenAddress,
      calldata: "0x095ea7b3000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000000000000000000000000000000000000000000000000000002710",
      decimals: 6,
      symbol: "USDT",
    });
    expect(() => decodeTransfer(source)).toThrow(/Unsupported function selector/i);
  });

  it("keeps M1 trust tiers intact", () => {
    expect(evidenceNodeSchema.safeParse({ id: "x", field: "recipient", value: recipientA, sourceId: "TX-001", trustTier: "T0_ONCHAIN", extraction: "explicit" }).success).toBe(true);
  });
});
