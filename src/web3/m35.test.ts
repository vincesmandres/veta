import { getOnchainTransaction, RealityCheckError } from "./get-onchain-transaction";
import { encodeFunctionData } from "viem";
import { decodeTransfer, buildOnchainEvidence } from "./index";
import { erc20Abi } from "./erc20-abi";
import type { VetaPublicClient } from "./public-client";
import { evidenceNodeSchema } from "../evidence/evidence-schema";
import { runSafetyKernel } from "../safety/safety-kernel";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetTransaction = vi.fn();
const mockClient = { getTransaction: mockGetTransaction } as unknown as VetaPublicClient;
const HASH = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const RPC_URL = "http://localhost:8545";

function getTransaction() {
  return getOnchainTransaction(HASH, RPC_URL, mockClient);
}

beforeEach(() => {
  mockGetTransaction.mockReset();
});

const fakeTx = (overrides: Record<string, unknown> = {}) => ({
  hash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  input: encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", BigInt(1250000000)],
  }),
  value: BigInt(0),
  blockNumber: BigInt(12345678),
  status: "success",
  ...overrides,
});

describe("M3.5 reality check", () => {
  it("fetches a real transaction and decodes calldata", async () => {
    mockGetTransaction.mockResolvedValue(fakeTx() as any);

    const tx = await getTransaction();
    expect(tx.to).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7");

    const source = {
      id: "TX-REAL-001",
      chain: "evm" as const,
      tokenAddress: tx.to as `0x${string}`,
      calldata: tx.input,
      decimals: 6,
      symbol: "USDT",
    };

    const decoded = decodeTransfer(source);
    expect(decoded.functionName).toBe("transfer");
    expect(decoded.recipient.toLowerCase()).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(decoded.amountRaw).toBe(BigInt(1250) * (BigInt(10) ** BigInt(6)));

    const evidence = buildOnchainEvidence(decoded, {
      transactionHash: tx.hash,
      ...(tx.blockNumber === null ? {} : { blockNumber: tx.blockNumber }),
      contractAddress: tx.to,
      network: "sepolia",
    });

    expect(evidence).toHaveLength(3);
    expect(evidence.every((n) => n.trustTier === "T0_ONCHAIN")).toBe(true);
    expect(evidence.find((n) => n.field === "asset")?.contractAddress).toBe(tx.to);
    expect(evidence.find((n) => n.field === "recipient")?.transactionHash).toBe(tx.hash);
    expect(evidence.find((n) => n.field === "recipient")?.blockNumber).toBe(tx.blockNumber?.toString());
    evidence.forEach((n) => expect(evidenceNodeSchema.safeParse(n).success).toBe(true));
  });

  it("rejects an invalid transaction hash", async () => {
    await expect(getOnchainTransaction("invalid", RPC_URL, mockClient)).rejects.toThrow(RealityCheckError);
  });

  it("rejects when transaction is not found", async () => {
    mockGetTransaction.mockResolvedValue(null as any);
    await expect(
      getTransaction(),
    ).rejects.toMatchObject({ code: "TX_NOT_FOUND" });
  });

  it("rejects a contract-creation transaction without a target", async () => {
    mockGetTransaction.mockResolvedValue(fakeTx({ to: null }) as any);
    await expect(getTransaction()).rejects.toMatchObject({ code: "NO_TRANSACTION_TARGET" });
  });

  it("rejects empty calldata", async () => {
    mockGetTransaction.mockResolvedValue(fakeTx({ input: "0x" }) as any);
    await expect(
      getTransaction(),
    ).rejects.toMatchObject({ code: "EMPTY_CALLDATA" });
  });

  it("rejects unsupported function selector", async () => {
    mockGetTransaction.mockResolvedValue(fakeTx({ input: "0x12345678" }) as any);
    await expect(
      getTransaction(),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FUNCTION" });
  });

  it("blocks when RPC fails", async () => {
    mockGetTransaction.mockRejectedValue(new Error("network error"));
    await expect(
      getTransaction(),
    ).rejects.toMatchObject({ code: "RPC_UNAVAILABLE" });
  });

  it("matching controlled authority with real T0 evidence produces APPROVE", async () => {
    mockGetTransaction.mockResolvedValue(fakeTx() as any);

    const tx = await getTransaction();
    const decoded = decodeTransfer({
      id: "TX-REAL",
      chain: "evm",
      tokenAddress: tx.to as `0x${string}`,
      calldata: tx.input,
      decimals: 6,
      symbol: "USDT",
    });

    const t0 = buildOnchainEvidence(decoded, {
      transactionHash: tx.hash,
      ...(tx.blockNumber === null ? {} : { blockNumber: tx.blockNumber }),
      contractAddress: tx.to,
      network: "sepolia",
    });

    const t1 = [
      {
        id: "REQ-1::recipient",
        field: "recipient" as const,
        value: decoded.recipient,
        sourceId: "REQ-1",
        trustTier: "T1_AUTHORITY" as const,
        extraction: "explicit" as const,
        evidenceText: decoded.recipient,
      },
      {
        id: "REQ-1::amount",
        field: "amount" as const,
        value: decoded.amountFormatted,
        sourceId: "REQ-1",
        trustTier: "T1_AUTHORITY" as const,
        extraction: "explicit" as const,
        evidenceText: `${decoded.amountFormatted} ${decoded.asset}`,
      },
      {
        id: "REQ-1::asset",
        field: "asset" as const,
        value: decoded.asset,
        sourceId: "REQ-1",
        trustTier: "T1_AUTHORITY" as const,
        extraction: "explicit" as const,
        evidenceText: decoded.asset,
      },
    ];

    const result = runSafetyKernel([...t0, ...t1]);
    expect(result.verdict).toBe("APPROVE");
  });

  it("mismatched controlled authority with real T0 evidence produces BLOCK", async () => {
    mockGetTransaction.mockResolvedValue(fakeTx() as any);

    const tx = await getTransaction();
    const decoded = decodeTransfer({
      id: "TX-REAL",
      chain: "evm",
      tokenAddress: tx.to as `0x${string}`,
      calldata: tx.input,
      decimals: 6,
      symbol: "USDT",
    });

    const t0 = buildOnchainEvidence(decoded, {
      transactionHash: tx.hash,
      ...(tx.blockNumber === null ? {} : { blockNumber: tx.blockNumber }),
      contractAddress: tx.to,
      network: "sepolia",
    });

    const t1 = [
      {
        id: "REQ-2::recipient",
        field: "recipient" as const,
        value: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceId: "REQ-2",
        trustTier: "T1_AUTHORITY" as const,
        extraction: "explicit" as const,
        evidenceText: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        id: "REQ-2::amount",
        field: "amount" as const,
        value: decoded.amountFormatted,
        sourceId: "REQ-2",
        trustTier: "T1_AUTHORITY" as const,
        extraction: "explicit" as const,
        evidenceText: `${decoded.amountFormatted} ${decoded.asset}`,
      },
      {
        id: "REQ-2::asset",
        field: "asset" as const,
        value: decoded.asset,
        sourceId: "REQ-2",
        trustTier: "T1_AUTHORITY" as const,
        extraction: "explicit" as const,
        evidenceText: decoded.asset,
      },
    ];

    const result = runSafetyKernel([...t0, ...t1]);
    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("RECIPIENT_MATCH mismatch");
  });
});
