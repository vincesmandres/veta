import { describe, expect, it } from "vitest";
import { resolveAuthority, verifyWithAuthority } from "./index";
import type { EvidenceNode } from "../evidence/evidence-schema";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
function n(id: string, field: EvidenceNode["field"], value: string, sourceType: NonNullable<EvidenceNode["sourceType"]>, trustTier: EvidenceNode["trustTier"]): EvidenceNode { return { id, field, value, sourceId: id, sourceType, trustTier, extraction: "explicit" }; }
function field(source: string, value: string, sourceType: NonNullable<EvidenceNode["sourceType"]>, trustTier: EvidenceNode["trustTier"] = "T1_AUTHORITY"): EvidenceNode { return n(source, "recipient", value, sourceType, trustTier); }

describe("M5 deterministic authority engine", () => {
  it("handles authority, corroboration, conflicts, and canonical values", () => {
    expect(resolveAuthority([field("v", A, "vendor_registry"), field("t", B, "free_text", "T3_UNTRUSTED")]).fields.recipient.value).toBe(A);
    expect(resolveAuthority([n("p", "amount", "1250", "payment_request", "T1_AUTHORITY"), n("i", "amount", "1250.0", "invoice", "T2_SUPPORTING")]).fields.amount.evidenceIds).toEqual(["p", "i"]);
    const supportConflict = resolveAuthority([n("p", "amount", "1250", "payment_request", "T1_AUTHORITY"), n("i", "amount", "1500", "invoice", "T2_SUPPORTING")]).fields.amount;
    expect(supportConflict.value).toBe("1250");
    expect(supportConflict.warnings).toContain("SUPPORTING_EVIDENCE_CONFLICT");
    expect(resolveAuthority([field("a", A, "payment_request"), field("b", B, "payment_request")]).fields.recipient).toMatchObject({ status: "CONFLICT", reason: "CONFLICTING_AUTHORITY", evidenceIds: ["a", "b"] });
    expect(resolveAuthority([field("i", A, "invoice", "T2_SUPPORTING"), field("t", A, "free_text", "T3_UNTRUSTED")]).fields.recipient).toMatchObject({ status: "UNRESOLVED", reason: "INSUFFICIENT_AUTHORITY" });
    expect(resolveAuthority([field("a", A, "payment_request"), field("b", A.toUpperCase(), "payment_request")]).fields.recipient.status).toBe("RESOLVED");
  });
  it("never grants T0 authority and cannot approve unresolved or conflicting fields", () => {
    const t0 = n("tx", "recipient", A, "evm_transaction", "T0_ONCHAIN");
    expect(resolveAuthority([t0]).fields.recipient).toMatchObject({ status: "UNRESOLVED", reason: "INSUFFICIENT_AUTHORITY" });
    expect(resolveAuthority([field("request", A, "payment_request"), t0]).fields.recipient.evidenceIds).toEqual(["request"]);
    expect(verifyWithAuthority([t0]).safety.verdict).toBe("REVIEW");
    expect(verifyWithAuthority([field("a", A, "payment_request"), field("b", B, "payment_request")]).safety.verdict).not.toBe("APPROVE");
  });
});
