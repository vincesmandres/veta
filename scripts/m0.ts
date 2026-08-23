import { extractPayment } from "../src/qvac/extract-payment";

const fixtures = [
  "Pay invoice INV-1042 for 1250 USDT to ACME.",
  "Send 320 USDC to Stark Industries for invoice INV-88.",
  "Pay Globex 75 USDT.",
];

async function main() {
  console.log("VETA - M0 QVAC ALIVE\n");

  for (const input of fixtures) {
    console.log(`Input:\n${input}`);
    try {
      const result = await extractPayment(input);
      console.log(`\nOutput:\n${JSON.stringify(result.paymentIntent, null, 2)}`);
      console.log(`\nModel: ${result.observation.model}`);
      console.log(`Latency: ${result.observation.latencyMs}ms`);
      console.log(`Schema: ${result.observation.schemaResult}`);
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
