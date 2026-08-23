import { describe, expect, it, vi } from "vitest";
import { extractPayment } from "./extract-payment";
import { paymentIntentSchema } from "./payment-schema";

const response = (content: string, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? "OK" : "Bad Request",
  json: async () => ({ choices: [{ message: { content } }] }),
}) as Response;

describe("payment extraction validation", () => {
  it("parses and validates a model response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(JSON.stringify({ operation: "payment", invoiceId: "INV-1042", amount: 1250, asset: "USDT", counterparty: "ACME" })));
    const result = await extractPayment("Pay invoice INV-1042 for 1250 USDT to ACME.", { fetchImpl });
    expect(result.paymentIntent.invoiceId).toBe("INV-1042");
    expect(result.observation.schemaResult).toBe("PASS");
  });

  it("rejects malformed JSON", async () => {
    await expect(extractPayment("input", { fetchImpl: vi.fn().mockResolvedValue(response("Here is the result: {}")) })).rejects.toMatchObject({ code: "MALFORMED_JSON" });
  });

  it("rejects invalid schema data", async () => {
    await expect(extractPayment("input", { fetchImpl: vi.fn().mockResolvedValue(response(JSON.stringify({ operation: "payment", invoiceId: null, amount: 0, asset: "", counterparty: "" }))) })).rejects.toMatchObject({ code: "SCHEMA_VALIDATION_FAILED" });
    expect(paymentIntentSchema.safeParse({ operation: "payment", invoiceId: null, amount: -1, asset: "USDT", counterparty: "ACME" }).success).toBe(false);
  });

  it("reports unavailable QVAC explicitly", async () => {
    await expect(extractPayment("input", { fetchImpl: vi.fn().mockRejectedValue(new Error("connect refused")) })).rejects.toMatchObject({ code: "QVAC_UNAVAILABLE" });
  });
});
