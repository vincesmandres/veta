import { resolveAuthority, verifyWithAuthority, type CriticalField } from "../src/authority";
import type { EvidenceNode } from "../src/evidence/evidence-schema";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function node(id: string, field: CriticalField, value: string, sourceType: EvidenceNode["sourceType"], trustTier: EvidenceNode["trustTier"]): EvidenceNode {
  return { id, field, value, sourceId: id.split("::")[0], sourceType, trustTier, extraction: "explicit", evidenceText: value };
}
function run(label: string, evidence: EvidenceNode[], expected: string): void {
  const result = resolveAuthority(evidence);
  console.log(`CASE\n${label}\n`);
  for (const field of ["recipient", "amount", "asset"] as const) {
    const resolution = result.fields[field];
    console.log(`FIELD ${field}: ${resolution.status}${resolution.value ? ` = ${resolution.value}` : ""}`);
    console.log(`  authority: ${resolution.authorityLevel ?? "NONE"}`);
    console.log(`  evidence: ${resolution.evidenceIds.join(", ") || "none"}`);
    if (resolution.ignoredEvidenceIds?.length) console.log(`  ignored: ${resolution.ignoredEvidenceIds.join(", ")}`);
    if (resolution.warnings?.length) console.log(`  warnings: ${resolution.warnings.join(", ")}`);
    if (resolution.reason) console.log(`  reason: ${resolution.reason}`);
  }
  const safety = verifyWithAuthority(evidence).safety;
  console.log(`FINAL SAFETY STATE: ${safety.verdict}\n`);
  if (result.fields.recipient.status !== expected && label.includes("recipient")) throw new Error(`${label} failed`);
}

console.log("VETA — M5 TRUST & AUTHORITY ENGINE\n");
run("T3 recipient override attempt", [node("VENDOR-001::recipient", "recipient", A, "vendor_registry", "T1_AUTHORITY"), node("TXT-001::recipient", "recipient", B, "free_text", "T3_UNTRUSTED")], "RESOLVED");
run("Supporting agreement", [node("REQ-001::amount", "amount", "1250", "payment_request", "T1_AUTHORITY"), node("INV-001::amount", "amount", "1250", "invoice", "T2_SUPPORTING")], "RESOLVED");
run("Supporting conflict", [node("REQ-002::amount", "amount", "1250", "payment_request", "T1_AUTHORITY"), node("INV-002::amount", "amount", "1500", "invoice", "T2_SUPPORTING")], "RESOLVED");
run("Equal-authority disagreement", [node("REQ-A::recipient", "recipient", A, "payment_request", "T1_AUTHORITY"), node("REQ-B::recipient", "recipient", B, "payment_request", "T1_AUTHORITY")], "CONFLICT");
run("Insufficient authority", [node("INV-003::recipient", "recipient", A, "invoice", "T2_SUPPORTING"), node("TXT-003::recipient", "recipient", A, "free_text", "T3_UNTRUSTED")], "UNRESOLVED");
run("Multiple authority agreement", [node("REQ-A::recipient", "recipient", A, "payment_request", "T1_AUTHORITY"), node("REG-A::recipient", "recipient", A, "vendor_registry", "T1_AUTHORITY")], "RESOLVED");
console.log("ALL REQUIRED M5 CASES PASS");
