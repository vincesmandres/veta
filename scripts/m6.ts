import { mkdirSync, writeFileSync } from "node:fs";
import { M6_DATASET_VERSION, M6_SCENARIOS, runAdversarialSuite } from "../src/adversarial";

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

async function main(): Promise<void> {
  console.log("VETA — M6 BREAK THE MODEL\n");
  const { results, metrics, failureCategories } = await runAdversarialSuite();
  const model = process.env.VETA_QVAC_MODEL ?? "veta-local";
  const artifact = {
    timestamp: new Date().toISOString(),
    model,
    datasetVersion: M6_DATASET_VERSION,
    scenarios: M6_SCENARIOS,
    results,
    metrics,
    failureCategories,
  };
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/m6-adversarial-results.json", JSON.stringify(artifact, null, 2));

  console.log(`Scenarios: ${metrics.totalScenarios}`);
  console.log(`Unsafe scenarios: ${metrics.unsafeScenarios}`);
  console.log(`Correct verdicts: ${metrics.correctVerdicts} / ${metrics.totalScenarios}`);
  console.log(`Unsafe approvals: ${metrics.unsafeApprovals}`);
  console.log(`Unsafe Approval Rate: ${percent(metrics.unsafeApprovalRate)}`);
  console.log(`QVAC failures: ${metrics.qvacFailures}`);
  console.log(`Tool failures: ${metrics.toolFailures}`);
  console.log(`Model Failure Containment: ${percent(metrics.modelFailureContainmentRate)}`);
  console.log(`Prompt injection scenarios: ${metrics.promptInjectionAttempts}`);
  console.log(`Prompt injection unsafe approvals: ${metrics.promptInjectionUnsafeApprovals}`);
  console.log(`Prompt Injection Containment: ${percent(metrics.promptInjectionContainmentRate)}\n`);

  console.log("ID   CATEGORY                   MODE           EXPECTED  ACTUAL    UNSAFE APPROVAL  PASS");
  for (const result of results) {
    console.log(`${result.scenarioId.padEnd(4)} ${result.category.padEnd(26)} ${result.executionMode.padEnd(14)} ${result.expectedVerdict.padEnd(9)} ${result.actualVerdict.padEnd(9)} ${(result.unsafeApproval ? "YES" : "NO").padEnd(16)} ${result.passed ? "PASS" : "FAIL"}`);
  }

  console.log("\nCATEGORY BREAKDOWN");
  for (const category of Array.from(new Set(M6_SCENARIOS.map((scenario) => scenario.category)))) {
    const categoryResults = results.filter((result) => result.category === category);
    const correct = categoryResults.filter((result) => result.actualVerdict === result.expectedVerdict).length;
    console.log(`${category}: ${correct}/${categoryResults.length} correct, ${categoryResults.filter((result) => result.unsafeApproval).length} unsafe approvals`);
  }
  console.log(`\nFailure categories: ${JSON.stringify(failureCategories)}`);
  console.log("Artifact: artifacts/m6-adversarial-results.json");

  if (metrics.unsafeApprovals > 0) {
    console.error(`\nSECURITY INVARIANT FAILED: ${metrics.unsafeApprovals} unsafe approval(s)`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
