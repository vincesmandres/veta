import { describe, expect, it } from "vitest";
import type { EvidenceNode } from "../evidence/evidence-schema";
import { runAgent, isTransientError } from "./orchestrator";
import { createEvidenceStore } from "./tool-registry";
import { evidenceNodeSchema } from "../evidence/evidence-schema";
import { calculateMetrics } from "./metrics";

const recipientA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const recipientB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const txHash = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const tokenAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as `0x${string}`;
const calldata = "0xa9059cbb000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa000000000000000000000000000000000000000000000000000000004a817c80" as `0x${string}`;

function evidenceNodes(sourceId: string, recipient: string, amount: string, asset: string, trustTier: EvidenceNode["trustTier"] = "T1_AUTHORITY"): EvidenceNode[] {
  const nodes: EvidenceNode[] = [
    { id: `${sourceId}::recipient`, field: "recipient", value: recipient, sourceId, trustTier, extraction: "explicit", evidenceText: recipient },
    { id: `${sourceId}::amount`, field: "amount", value: amount, sourceId, trustTier, extraction: "explicit", evidenceText: `${amount} ${asset}` },
    { id: `${sourceId}::asset`, field: "asset", value: asset, sourceId, trustTier, extraction: "explicit", evidenceText: asset },
  ];
  nodes.forEach((node) => evidenceNodeSchema.parse(node));
  return nodes;
}

function rawTransaction(recipient = recipientA) {
  const encoded = recipient === recipientA ? calldata : calldata.replace(/a{40}/, "b".repeat(40)) as `0x${string}`;
  return { hash: txHash, to: tokenAddress, input: encoded, value: BigInt(0), blockNumber: BigInt(123), status: undefined };
}

describe("M4 tool reliability", () => {
  it("allows registered tool execution", async () => {
    const result = await runAgent("Verify transaction " + txHash + " against REQ-001.", {
      evidenceStore: createEvidenceStore({ "REQ-001": evidenceNodes("REQ-001", recipientA, "1250", "USDT") }),
      mockQvacAction: () => ({ action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-001" } }),
    });
    expect(result.steps.some((step) => step.action.action === "call_tool" && step.action.tool === "get_evidence")).toBe(true);
  });

  it("rejects unknown tool", async () => {
    const result = await runAgent("task", { mockQvacAction: () => ({ action: "call_tool", tool: "unknown_tool", arguments: {} }) });
    expect(result.finalVerdict).toBe("REVIEW");
    expect(result.reason).toBe("TOOL_ORCHESTRATION_FAILED");
  });

  it("rejects malformed arguments via schema", async () => {
    const result = await runAgent("task", { mockQvacAction: () => ({ action: "call_tool", tool: "get_evidence", arguments: { sourceId: 123 } }) });
    expect(result.finalVerdict).toBe("REVIEW");
  });

  it("missing evidence cannot approve", async () => {
    const result = await runAgent("Verify transaction " + txHash + " against REQ-MISSING.", { mockQvacAction: () => ({ action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-MISSING" } }) });
    expect(result.finalVerdict).toBe("REVIEW");
  });

  it("RPC failure cannot approve", async () => {
    const result = await runAgent("Verify transaction " + txHash + " against REQ-001.", {
      evidenceStore: createEvidenceStore({ "REQ-001": evidenceNodes("REQ-001", recipientA, "1250", "USDT") }),
      mockQvacAction: () => ({ action: "call_tool", tool: "get_transaction", arguments: { txHash } }),
    });
    expect(result.finalVerdict).toBe("REVIEW");
  });

  it("unsupported function cannot approve", async () => {
    let step = 0;
    const result = await runAgent("Verify transaction " + txHash + " against REQ-001.", {
      evidenceStore: createEvidenceStore({ "REQ-001": evidenceNodes("REQ-001", recipientA, "1250", "USDT") }),
      mockQvacAction: () => {
        step += 1;
        return step === 1
          ? { action: "call_tool", tool: "decode_transaction", arguments: { transaction: { id: "TX", tokenAddress, calldata: "0x12345678", decimals: 6, symbol: "USDT" } } }
          : { action: "finish", summary: "done" };
      },
    });
    expect(result.finalVerdict).toBe("REVIEW");
  });

  it("incomplete chain cannot approve", async () => {
    const result = await runAgent("Verify transaction " + txHash + " against REQ-001.", { mockQvacAction: () => ({ action: "finish", summary: "done" }) });
    expect(result.finalVerdict).toBe("REVIEW");
    expect(result.reason).toContain("INCOMPLETE_TOOL_CHAIN");
  });

  it("Safety Kernel BLOCK cannot be overridden", async () => {
    const evidence = createEvidenceStore({
      "REQ-002": evidenceNodes("REQ-002", recipientA, "1250", "USDT"),
      "TX-B": evidenceNodes("TX-B", recipientB, "1250", "USDT", "T0_ONCHAIN"),
    });
    let step = 0;
    const result = await runAgent("Verify transaction " + txHash + " against REQ-002.", {
      evidenceStore: evidence,
      transactionClient: { getTransaction: async () => rawTransaction(recipientB) },
      rpcUrl: "http://mock",
      mockQvacAction: () => {
        step += 1;
        if (step === 1) return { action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-002" } };
        if (step === 2) return { action: "call_tool", tool: "get_transaction", arguments: { txHash } };
        if (step === 3) return { action: "call_tool", tool: "verify_transaction", arguments: { authorityEvidence: evidence.get("REQ-002"), onchainEvidence: evidence.get("TX-B") } };
        return { action: "finish", summary: "looks safe" };
      },
    });
    expect(result.finalVerdict).toBe("BLOCK");
    expect(result.verificationVerdict).toBe("BLOCK");
  });

  it("Safety Kernel REVIEW cannot be upgraded to APPROVE", async () => {
    const result = await runAgent("Verify transaction " + txHash + " against REQ-MISSING.", { mockQvacAction: () => ({ action: "finish", summary: "approved" }) });
    expect(result.finalVerdict).toBe("REVIEW");
  });

  it("enforces step limit", async () => {
    const result = await runAgent("task", { maxSteps: 3, mockQvacAction: () => ({ action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-1" } }) });
    expect(result.finalVerdict).toBe("REVIEW");
    expect(result.reason).toBe("TOOL_CHAIN_LIMIT_EXCEEDED");
  });

  it("records bounded retries", async () => {
    const result = await runAgent("task", { mockQvacAction: () => ({ action: "call_tool", tool: "get_transaction", arguments: { txHash } }) });
    expect(result.steps.some((step) => step.retries > 0)).toBe(true);
  });

  it("preserves execution trace", async () => {
    const result = await runAgent("Verify transaction " + txHash + " against REQ-001.", {
      evidenceStore: createEvidenceStore({ "REQ-001": evidenceNodes("REQ-001", recipientA, "1250", "USDT") }),
      mockQvacAction: () => ({ action: "call_tool", tool: "get_evidence", arguments: { sourceId: "REQ-001" } }),
    });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0].step).toBe(1);
  });

  it("treats T3 and T2 evidence alone as insufficient", async () => {
    for (const trustTier of ["T2_SUPPORTING", "T3_UNTRUSTED"] as const) {
      const result = await runAgent("Verify transaction " + txHash + " against REQ-001.", {
        evidenceStore: createEvidenceStore({ "REQ-001": evidenceNodes("REQ-001", recipientA, "1250", "USDT", trustTier) }),
        mockQvacAction: () => ({ action: "finish", summary: "done" }),
      });
      expect(result.finalVerdict).toBe("REVIEW");
    }
  });
});

describe("M4 transient error handling", () => {
  it("identifies transient errors correctly", () => {
    expect(isTransientError("RPC_UNAVAILABLE")).toBe(true);
    expect(isTransientError("RECIPIENT_MISMATCH")).toBe(false);
    expect(isTransientError("UNSUPPORTED_FUNCTION")).toBe(false);
  });
});

describe("M4 metrics", () => {
  it("calculates reliability rates from observed counts", () => {
    const rates = calculateMetrics({
      totalRuns: 10,
      qvacActionResponses: 10,
      validStructuredActions: 8,
      completeChains: 8,
      toolSelectionFailures: 1,
      structuredOutputFailures: 2,
      toolExecutionFailures: 1,
      retries: 3,
      verdictCases: 10,
      correctVerdicts: 9,
      unsafeScenarios: 5,
      unsafeApprovals: 1,
      failureCategories: {},
    });
    expect(rates.toolChainSuccessRate).toBe(0.8);
    expect(rates.structuredOutputValidityRate).toBe(0.8);
    expect(rates.verdictAccuracy).toBe(0.9);
    expect(rates.unsafeApprovalRate).toBe(0.2);
  });
});
