import { describe, expect, it } from "vitest";
import type { EvidenceNode } from "../evidence/evidence-schema";
import { runSafetyKernel } from "./safety-kernel";

const recipientA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const recipientAChecksummed = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
const recipientB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function node(
  id: string,
  field: EvidenceNode["field"],
  value: string | number | null,
  trustTier: EvidenceNode["trustTier"],
): EvidenceNode {
  return { id, field, value, sourceId: id.split("::")[0], trustTier, extraction: value === null ? "missing" : "explicit" };
}

function evidence(
  values: { recipient?: string | number | null; amount?: string | number | null; asset?: string | number | null },
  trustTier: EvidenceNode["trustTier"],
  sourceId: string,
): EvidenceNode[] {
  return (Object.entries(values) as Array<[EvidenceNode["field"], string | number | null | undefined]>)
    .filter((entry): entry is [EvidenceNode["field"], string | number | null] => entry[1] !== undefined)
    .map(([field, value]) => node(`${sourceId}::${field}`, field, value, trustTier));
}

function completeEvidence(observed = { recipient: recipientA, amount: "1250", asset: "USDT" }) {
  return [
    ...evidence({ recipient: recipientA, amount: "1250", asset: "USDT" }, "T1_AUTHORITY", "REQ-1"),
    ...evidence(observed, "T0_ONCHAIN", "TX-1"),
  ];
}

describe("M3 deterministic safety kernel", () => {
  it("approves an exact match", () => {
    const result = runSafetyKernel(completeEvidence({ recipient: recipientAChecksummed, amount: "1250", asset: "usdt" }));
    expect(result.verdict).toBe("APPROVE");
    expect(result.checks.every((check) => check.status === "PASS")).toBe(true);
  });

  it("blocks a recipient mismatch", () => {
    const result = runSafetyKernel(completeEvidence({ recipient: recipientB, amount: "1250", asset: "USDT" }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("RECIPIENT_MATCH mismatch");
  });

  it("blocks an amount mismatch", () => {
    const result = runSafetyKernel(completeEvidence({ recipient: recipientA, amount: "12500", asset: "USDT" }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("AMOUNT_MATCH mismatch");
  });

  it("blocks an asset mismatch", () => {
    const result = runSafetyKernel(completeEvidence({ recipient: recipientA, amount: "1250", asset: "OTHER" }));
    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("ASSET_MATCH mismatch");
  });

  it("reviews when authoritative evidence is missing", () => {
    const result = runSafetyKernel(evidence({ recipient: recipientA, amount: "1250", asset: "USDT" }, "T0_ONCHAIN", "TX-1"));
    expect(result.verdict).toBe("REVIEW");
    expect(result.reasons).toContain("INSUFFICIENT_EVIDENCE");
  });

  it.each(["T2_SUPPORTING", "T3_UNTRUSTED"] as const)("does not authorize from %s alone", (trustTier) => {
    const result = runSafetyKernel([
      ...evidence({ recipient: recipientA, amount: "1250", asset: "USDT" }, trustTier, "LOW-1"),
      ...evidence({ recipient: recipientA, amount: "1250", asset: "USDT" }, "T0_ONCHAIN", "TX-1"),
    ]);
    expect(result.verdict).toBe("REVIEW");
  });

  it("treats T0 as observed execution reality", () => {
    const result = runSafetyKernel(completeEvidence({ recipient: recipientB, amount: "1250", asset: "USDT" }));
    expect(result.checks.find((check) => check.type === "RECIPIENT_MATCH")?.observed).toBe(recipientB);
    expect(result.evidenceUsed).toEqual(["REQ-1", "TX-1"]);
  });

  it("blocks a known mismatch before considering missing evidence", () => {
    const result = runSafetyKernel([
      ...evidence({ recipient: recipientA }, "T1_AUTHORITY", "REQ-1"),
      ...evidence({ recipient: recipientB }, "T0_ONCHAIN", "TX-1"),
    ]);
    expect(result.verdict).toBe("BLOCK");
    expect(result.reasons).toContain("RECIPIENT_MATCH mismatch");
  });

  it("reviews conflicting T1 authority instead of choosing", () => {
    const result = runSafetyKernel([
      ...evidence({ recipient: recipientA, amount: "1250", asset: "USDT" }, "T1_AUTHORITY", "REQ-1"),
      ...evidence({ recipient: recipientB }, "T1_AUTHORITY", "REQ-2"),
      ...evidence({ recipient: recipientA, amount: "1250", asset: "USDT" }, "T0_ONCHAIN", "TX-1"),
    ]);
    expect(result.verdict).toBe("REVIEW");
    expect(result.reasons).toContain("CONFLICTING_AUTHORITY");
  });

  it("compares large raw amounts exactly without floating point", () => {
    const raw = "123456789012345678901234567890";
    expect(runSafetyKernel(completeEvidence({ recipient: recipientA, amount: raw, asset: "USDT" })).verdict).toBe("BLOCK");
    const matching = runSafetyKernel([
      ...evidence({ recipient: recipientA, amount: raw, asset: "USDT" }, "T1_AUTHORITY", "REQ-1"),
      ...evidence({ recipient: recipientA, amount: raw, asset: "USDT" }, "T0_ONCHAIN", "TX-1"),
    ]);
    expect(matching.verdict).toBe("APPROVE");
  });
});
