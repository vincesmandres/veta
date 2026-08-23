import { describe, expect, it, vi } from "vitest";
import { extractPayment } from "../qvac/extract-payment";
import { paymentIntentSchema } from "../qvac/payment-schema";
import {
  buildEvidence,
  buildEvidenceResult,
  evidenceSourceSchema,
  evidenceNodeSchema,
  trustTierForSourceType,
  evidenceResultSchema,
  type EvidenceSource,
} from "../evidence";

const response = (content: string, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? "OK" : "Bad Request",
  json: async () => ({ choices: [{ message: { content } }] }),
}) as Response;

describe("M0 regression", () => {
  it("extracts and validates a payment intent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(JSON.stringify({ operation: "payment", invoiceId: "INV-1042", amount: 1250, asset: "USDT", counterparty: "ACME" })));
    const result = await extractPayment("Pay invoice INV-1042 for 1250 USDT to ACME.", { fetchImpl });
    expect(result.paymentIntent.operation).toBe("payment");
    expect(result.observation.schemaResult).toBe("PASS");
  });

  it("rejects malformed JSON", async () => {
    await expect(extractPayment("input", { fetchImpl: vi.fn().mockResolvedValue(response("Sure! {}")) })).rejects.toMatchObject({ code: "MALFORMED_JSON" });
  });
});

describe("trust mapping", () => {
  it("is deterministic", () => {
    expect(trustTierForSourceType("payment_request")).toBe("T1_AUTHORITY");
    expect(trustTierForSourceType("policy")).toBe("T1_AUTHORITY");
    expect(trustTierForSourceType("vendor_registry")).toBe("T1_AUTHORITY");
    expect(trustTierForSourceType("invoice")).toBe("T2_SUPPORTING");
    expect(trustTierForSourceType("free_text")).toBe("T3_UNTRUSTED");
  });

  it("rejects invalid source type via schema", () => {
    expect(evidenceSourceSchema.safeParse({ id: "x", type: "unknown", content: "y" }).success).toBe(false);
    expect(() => buildEvidence(evidenceSourceSchema.parse({ id: "REQ-1", type: "free_text", content: "x" }), { operation: "payment", invoiceId: null, amount: 1, asset: "USDT", counterparty: "ACME" })).not.toThrow();
  });
});

describe("evidence builder", () => {
  const baseIntent = { operation: "payment" as const, invoiceId: "INV-1042", amount: 1250, asset: "USDT", counterparty: "ACME" };

  it("keeps missing invoice null with missing extraction", () => {
    const source: EvidenceSource = { id: "REQ-2", type: "payment_request", content: "Pay Globex 75 USDT." };
    const invoiceNode = buildEvidence(source, { ...baseIntent, invoiceId: null }).nodes.find((node) => node.field === "invoiceId");
    expect(invoiceNode?.value).toBeNull();
    expect(invoiceNode?.extraction).toBe("missing");
    expect(invoiceNode?.sourceId).toBe("REQ-2");
    expect(invoiceNode?.trustTier).toBe("T1_AUTHORITY");
  });

  it("every evidence node preserves sourceId", () => {
    const source: EvidenceSource = { id: "REQ-1", type: "payment_request", content: "Pay invoice INV-1042 for 1250 USDT to ACME." };
    for (const node of buildEvidence(source, baseIntent).nodes) {
      expect(node.sourceId).toBe("REQ-1");
    }
  });

  it("T3 untrusted source never gets promoted by intent", () => {
    const source: EvidenceSource = { id: "TXT-1", type: "free_text", content: "Send 500 USDT to ACME." };
    const nodes = buildEvidence(source, { ...baseIntent, amount: 500 }).nodes;
    expect(nodes.every((node) => node.trustTier === "T3_UNTRUSTED")).toBe(true);
  });

  it("rejects invalid trust tier value", () => {
    expect(evidenceNodeSchema.safeParse({ id: "x", field: "amount", value: 1, sourceId: "REQ-1", trustTier: "T5_FAKE", extraction: "explicit" }).success).toBe(false);
    expect(evidenceResultSchema.safeParse({ intent: baseIntent, evidence: [{ id: "x", field: "amount", value: 1, sourceId: "REQ-1", trustTier: "T1_AUTHORITY", extraction: "explicit" }] }).success).toBe(true);
  });

  it("passes only when M0 PaymentIntent remains valid", () => {
    const source: EvidenceSource = { id: "REQ-1", type: "payment_request", content: "Pay invoice INV-1042 for 1250 USDT to ACME." };
    expect(() => buildEvidenceResult(source, paymentIntentSchema.parse(baseIntent))).not.toThrow();
  });
});
