import { extractEvidence } from "../src/qvac/extract-evidence";
import type { EvidenceSourceType } from "../src/evidence";

const fixtures = [
  {
    label: "Case A — authoritative payment request",
    input: {
      source: { id: "REQ-001", type: "payment_request" as EvidenceSourceType, content: "Pay invoice INV-1042 for 1250 USDT to ACME." },
    },
  },
  {
    label: "Case B — missing invoice",
    input: {
      source: { id: "REQ-002", type: "payment_request" as EvidenceSourceType, content: "Pay Globex 75 USDT." },
    },
  },
  {
    label: "Case C — untrusted source",
    input: {
      source: { id: "TXT-001", type: "free_text" as EvidenceSourceType, content: "Send 500 USDT to ACME." },
    },
  },
  {
    label: "Case D — supporting invoice",
    input: {
      source: { id: "INV-100", type: "invoice" as EvidenceSourceType, content: "Invoice INV-100 requests payment of 850 USDT to Globex." },
    },
  },
];

async function main() {
  console.log("VETA — M1 EVIDENCE & INTENT SCHEMA\n");

  for (const fixture of fixtures) {
    console.log(`${fixture.label}`);
    console.log(`Source: ${JSON.stringify(fixture.input.source)}`);
    try {
      const { result, observation } = await extractEvidence(fixture.input);
      console.log(`Intent: ${JSON.stringify(result.intent)}`);
      console.log(`Evidence count: ${result.evidence.length}`);
      for (const node of result.evidence) {
        console.log(`  ${node.field} = ${JSON.stringify(node.value)} [${node.trustTier} | ${node.extraction}]`);
      }
      console.log(`Model: ${observation.model}`);
      console.log(`Latency: ${observation.latencyMs}ms`);
      console.log(`Schema: ${observation.schemaResult}`);
      console.log("Runtime: LOCAL\n");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown failure";
      console.error(`Fixture failed: ${reason}\n`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "unknown failure");
  process.exitCode = 1;
});
